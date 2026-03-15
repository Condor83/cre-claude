import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join, extname } from 'path';
import {
	addSectionImage,
	getSectionImages,
	updateImageCaption,
	updateImageOrder,
	deleteImage
} from '$lib/db/index.js';

const PROJECT_ROOT = process.env.CRE_DATA_DIR || process.cwd();
const IMAGES_DIR = join(PROJECT_ROOT, 'data', 'images');

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 15 * 1024 * 1024; // 15MB

const EXT_MAP: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/gif': '.gif'
};

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const reportId = Number(formData.get('report_id'));
	const sectionKey = formData.get('section_key') as string;
	const caption = (formData.get('caption') as string) || null;
	const sortOrder = Number(formData.get('sort_order') ?? 0);

	if (!file || !reportId || !sectionKey) {
		return json({ error: 'file, report_id, and section_key are required' }, { status: 400 });
	}

	if (!ALLOWED_TYPES.has(file.type)) {
		return json({ error: `Invalid file type: ${file.type}. Allowed: jpg, png, webp, gif` }, { status: 400 });
	}

	if (file.size > MAX_SIZE) {
		return json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 15MB` }, { status: 400 });
	}

	// Save to disk
	const reportDir = join(IMAGES_DIR, String(reportId));
	mkdirSync(reportDir, { recursive: true });

	const ext = EXT_MAP[file.type] || extname(file.name) || '.jpg';
	const filename = `${randomUUID()}${ext}`;
	const filePath = join(reportDir, filename);

	const buffer = Buffer.from(await file.arrayBuffer());
	writeFileSync(filePath, buffer);

	// Save to DB
	const id = addSectionImage(reportId, sectionKey, filePath, caption, sortOrder);

	return json({ id, file_path: filePath, caption, sort_order: sortOrder });
};

export const GET: RequestHandler = async ({ url }) => {
	const imageId = Number(url.searchParams.get('id'));
	if (!imageId) {
		// List images for a section
		const reportId = Number(url.searchParams.get('report_id'));
		const sectionKey = url.searchParams.get('section_key');
		if (!reportId || !sectionKey) {
			return json({ error: 'id or (report_id + section_key) required' }, { status: 400 });
		}
		const images = getSectionImages(reportId, sectionKey);
		return json(images);
	}

	// Serve image file by looking up path from DB
	const { getDb } = await import('$lib/db/index.js');
	const db = getDb();
	const row = db.prepare('SELECT file_path FROM section_images WHERE id = ?').get(imageId) as { file_path: string } | undefined;

	if (!row || !existsSync(row.file_path)) {
		return new Response('Image not found', { status: 404 });
	}

	const buffer = readFileSync(row.file_path);
	const ext = extname(row.file_path).toLowerCase();
	const contentType = ext === '.png' ? 'image/png'
		: ext === '.webp' ? 'image/webp'
		: ext === '.gif' ? 'image/gif'
		: 'image/jpeg';

	return new Response(buffer, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'no-cache'
		}
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { id, caption, sort_order } = body;

	if (!id) return json({ error: 'id is required' }, { status: 400 });

	if (caption !== undefined) updateImageCaption(id, caption);
	if (sort_order !== undefined) updateImageOrder(id, sort_order);

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const imageId = Number(url.searchParams.get('id'));
	if (!imageId) return json({ error: 'id is required' }, { status: 400 });

	const filePath = deleteImage(imageId);
	if (filePath && existsSync(filePath)) {
		try { unlinkSync(filePath); } catch { /* ignore */ }
	}

	return json({ ok: true });
};
