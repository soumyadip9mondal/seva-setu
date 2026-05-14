const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const imagekit = require('../config/imagekit');
const { aiVerificationQueue } = require('../config/queue');

const router = express.Router();

/**
 * @route   POST /api/tasks
 * @desc    Assign a volunteer to a need
 * @access  Private (Coordinator)
 */
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { need_id, volunteer_id, notes } = req.body;

  try {
    const taskId = await prisma.$transaction(async (tx) => {
      // 1. Create task
      const task = await tx.task.create({
        data: {
          needId: need_id,
          assignedVolunteerId: volunteer_id,
          notes,
          status: 'assigned',
          assignedAt: new Date(),
        },
      });

      // 2. Update need status safely
      await tx.need.update({
        where: { id: need_id },
        data: { status: 'assigned', updatedAt: new Date() },
        select: { id: true },
      });

      return task.id;
    });

    res.status(201).json({ taskId, message: 'Volunteer assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/tasks/:id/checkin
 * @desc    Volunteer GPS check-in
 * @access  Private (Volunteer)
 */
router.patch('/:id/checkin', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { lat, lng } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: req.params.id },
        data: {
          status: 'in_progress',
          checkedInAt: new Date(),
          checkInLat: lat ? Number(lat) : null,
          checkInLng: lng ? Number(lng) : null,
        },
      });

      await tx.need.update({
        where: { id: task.needId },
        data: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
        select: { id: true },
      });
    });

    res.json({ message: 'Checked in successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const exifr = require('exifr');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Configure Multer for image uploads (streaming to disk to prevent OOM)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + (file.originalname?.replace(/\s+/g, '_') || 'upload.jpg'));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * @route   PATCH /api/tasks/:id/complete
 * @desc    Mark task as completed with proof, EXIF GPS check, and AI semantic verification
 * @access  Private (Volunteer)
 */
router.patch('/:id/complete', auth, upload.single('image'), async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ 
      where: { id: req.params.id },
      include: { need: true }
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!req.file) {
      return res.status(400).json({ message: 'Proof of completion image is required.' });
    }

    // Fetch lat/lng for the need for proximity verification in the worker
    const needLocation = await prisma.$queryRaw`
      SELECT ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat 
      FROM needs WHERE id = ${task.needId}::uuid
    `;
    const { lat, lng } = needLocation[0] || { lat: 0, lng: 0 };

    // --- 1. Upload to ImageKit IMMEDIATELY (prevents ENOENT in worker) ---
    const fileBuffer = fs.readFileSync(req.file.path);
    const uploadResponse = await imagekit.upload({
      file: fileBuffer,
      fileName: req.file.filename,
      folder: '/sevasetu/tasks'
    });

    // --- 2. Queue the AI Verification Job with the cloud URL ---
    await aiVerificationQueue.add('verify-task', {
      type: 'task',
      id: task.id,
      imageUrl: uploadResponse.url,
      fileName: req.file.filename,
      metadata: { 
        lat: Number(lat), 
        lng: Number(lng),
        browserLat: req.body.browserLat ? Number(req.body.browserLat) : null,
        browserLng: req.body.browserLng ? Number(req.body.browserLng) : null
      }
    });

    // Cleanup local file immediately
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.status(202).json({
      message: 'Task completion submitted and queued for verification.',
      taskId: task.id,
      status: 'verifying'
    });

  } catch (err) {
    console.error('[TASKS] Complete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/:id/status
 * @desc    Check the status of task completion verification
 * @access  Private
 */
router.get('/:id/status', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        isCompletionVerified: true,
        completionImageUrl: true,
        verificationResult: true
      }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching status' });
  }
});


/**
 * @route   GET /api/tasks/my
 * @desc    Get assigned tasks for the logged-in volunteer
 */
router.get('/my', auth, async (req, res) => {
  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id as task_id,
        t.status as task_status,
        t.assigned_at,
        t.completed_at,
        t.check_in_lat,
        t.check_in_lng,
        t.is_completion_verified,
        n.title,
        n.need_type,
        n.urgency_score,
        n.ward,
        n.district,
        n.contact_number,
        n.contact_number as "contactNumber",
        n.image_url,
        ST_X(n.location::geometry) as lng,
        ST_Y(n.location::geometry) as lat,
        ST_X(v.location::geometry) as volunteer_lng,
        ST_Y(v.location::geometry) as volunteer_lat,
        CASE WHEN v.location IS NOT NULL AND n.location IS NOT NULL
          THEN ST_Distance(v.location::geography, n.location::geography) / 1000
          ELSE NULL
        END as server_distance_km
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      LEFT JOIN volunteers v ON v.user_id = t.assigned_volunteer_id
      WHERE t.assigned_volunteer_id = ${req.user.id}::uuid
      ORDER BY t.assigned_at DESC
    `;

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for coordinator dashboard
 * @access  Private (Coordinator)
 */
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id AS task_id,
        t.status AS task_status,
        t.assigned_at,
        t.checked_in_at,
        t.completed_at,
        t.is_completion_verified AS is_verified,
        t.need_id,
        n.title AS need_title,
        n.status AS need_status,
        u.id AS volunteer_id,
        u.name AS volunteer_name
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      JOIN users u ON t.assigned_volunteer_id = u.id
      ORDER BY t.assigned_at DESC
    `;

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════
// BROADCAST DISPATCH ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/tasks/my-broadcasts
 * @desc    Get pending broadcast requests for the logged-in volunteer
 * @access  Private (Volunteer)
 */
router.get('/my-broadcasts', auth, async (req, res) => {
  try {
    const broadcasts = await prisma.$queryRaw`
      SELECT
        br.id AS broadcast_id,
        br.need_id,
        br.status AS broadcast_status,
        br.distance_km,
        br.created_at,
        br.expires_at,
        n.title,
        n.need_type,
        n.urgency_score,
        n.ward,
        n.district,
        n.people_affected,
        n.status AS need_status,
        ST_X(n.location::geometry) as lng,
        ST_Y(n.location::geometry) as lat
      FROM broadcast_requests br
      JOIN needs n ON br.need_id = n.id
      WHERE br.volunteer_id = ${req.user.id}::uuid
        AND br.status = 'pending'
        AND br.expires_at > NOW()
        AND n.status = 'open'
      ORDER BY br.created_at DESC
    `;

    res.json(broadcasts);
  } catch (err) {
    console.error('[BROADCAST] Error fetching broadcasts:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/tasks/accept-broadcast
 * @desc    Volunteer accepts a broadcast — creates task, locks need, expires other broadcasts
 * @access  Private (Volunteer)
 * 
 * CONCURRENCY: Uses a Prisma transaction to prevent double-assignment.
 */
router.post('/accept-broadcast', auth, async (req, res) => {
  const { need_id } = req.body;

  if (!need_id) {
    return res.status(400).json({ message: 'need_id is required' });
  }

  // ── Step 0: Ensure we have the DB UUID (not the Clerk ID) ───────────
  let volunteerUuid = req.user.id;
  if (volunteerUuid.startsWith('user_')) {
    const user = await prisma.user.findUnique({
      where: { clerkId: volunteerUuid },
      select: { id: true }
    });
    if (!user) return res.status(404).json({ message: 'User not found in local database' });
    volunteerUuid = user.id;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. ATOMIC LOCK: Try to update the need ONLY IF it is still 'open'
      // This mathematically guarantees that only ONE transaction can ever win this race.
      const lockedNeed = await tx.need.updateMany({
        where: { id: need_id, status: 'open' },
        data: { status: 'assigned', updatedAt: new Date() },
      });

      if (lockedNeed.count === 0) {
        throw new Error('ALREADY_ASSIGNED');
      }

      // 2. Fetch the need details for the response
      const need = await tx.need.findUnique({
        where: { id: need_id },
        select: { title: true }
      });

      // 3. Check that this volunteer has a valid, non-expired broadcast
      const broadcast = await tx.broadcastRequest.findFirst({
        where: {
          needId: need_id,
          volunteerId: volunteerUuid,
          status: 'pending',
        },
      });

      if (!broadcast) throw new Error('NO_BROADCAST');
      if (new Date() > new Date(broadcast.expiresAt)) throw new Error('BROADCAST_EXPIRED');

      // 4. Create the task assignment safely
      const task = await tx.task.create({
        data: {
          needId: need_id,
          assignedVolunteerId: volunteerUuid,
          notes: `Auto-assigned via broadcast dispatch`,
          status: 'assigned',
          assignedAt: new Date(),
        },
      });

      // 5. Mark this broadcast as accepted
      await tx.broadcastRequest.update({
        where: { id: broadcast.id },
        data: { status: 'accepted' },
      });

      // 6. Expire all other pending broadcasts for this need
      await tx.broadcastRequest.updateMany({
        where: {
          needId: need_id,
          status: 'pending',
          id: { not: broadcast.id },
        },
        data: { status: 'expired' },
      });

      return { taskId: task.id, needTitle: need.title };
    }, {
      timeout: 20000,
      maxWait: 10000
    });

    console.log(`[BROADCAST] ✅ Volunteer ${req.user.id} accepted need ${need_id} → Task ${result.taskId}`);
    res.status(201).json({
      message: `Mission accepted: "${result.needTitle}"`,
      taskId: result.taskId,
    });
  } catch (err) {
    const knownErrors = {
      'NEED_NOT_FOUND': { status: 404, message: 'This need no longer exists.' },
      'ALREADY_ASSIGNED': { status: 409, message: 'This mission has already been accepted by another volunteer.' },
      'NO_BROADCAST': { status: 404, message: 'No valid broadcast request found for this need.' },
      'BROADCAST_EXPIRED': { status: 410, message: 'The 30-minute broadcast window has expired.' },
    };

    const known = knownErrors[err.message];
    if (known) {
      return res.status(known.status).json({ message: known.message });
    }

    console.error('[BROADCAST] Accept error:', err);
    res.status(500).json({ message: 'Server error', details: err.message, stack: err.stack });
  }
});

/**
 * @route   POST /api/tasks/reject-broadcast
 * @desc    Volunteer rejects a broadcast request (hides it from their view)
 * @access  Private (Volunteer)
 */
router.post('/reject-broadcast', auth, async (req, res) => {
  const { need_id } = req.body;

  if (!need_id) {
    return res.status(400).json({ message: 'need_id is required' });
  }

  // Resolve Clerk ID to DB UUID if necessary
  let volunteerUuid = req.user.id;
  if (volunteerUuid.startsWith('user_')) {
    const user = await prisma.user.findUnique({
      where: { clerkId: volunteerUuid },
      select: { id: true }
    });
    if (user) volunteerUuid = user.id;
  }

  try {
    const updated = await prisma.broadcastRequest.updateMany({
      where: {
        needId: need_id,
        volunteerId: volunteerUuid,
        status: 'pending',
      },
      data: { status: 'rejected' },
    });

    if (updated.count === 0) {
      return res.status(404).json({ message: 'No pending broadcast found for this need.' });
    }

    res.json({ message: 'Broadcast rejected' });
  } catch (err) {
    console.error('[BROADCAST] Reject error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/broadcast-status/:needId
 * @desc    Get broadcast status for a specific need (for coordinator dashboard)
 * @access  Private (Coordinator)
 */
router.get('/broadcast-status/:needId', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const broadcasts = await prisma.$queryRaw`
      SELECT
        br.id,
        br.status,
        br.distance_km,
        br.created_at,
        br.expires_at,
        u.name AS volunteer_name
      FROM broadcast_requests br
      JOIN users u ON br.volunteer_id = u.id
      WHERE br.need_id = ${req.params.needId}::uuid
      ORDER BY br.created_at DESC
    `;

    const summary = {
      total: broadcasts.length,
      pending: broadcasts.filter(b => b.status === 'pending').length,
      accepted: broadcasts.filter(b => b.status === 'accepted').length,
      rejected: broadcasts.filter(b => b.status === 'rejected').length,
      expired: broadcasts.filter(b => b.status === 'expired').length,
      expiresAt: broadcasts[0]?.expires_at || null,
      volunteers: broadcasts,
    };

    res.json(summary);
  } catch (err) {
    console.error('[BROADCAST] Status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
