import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const UPLOADS_DIR = 'data/uploads';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Ensure uploads directory exists
		if (!existsSync(UPLOADS_DIR)) {
			mkdirSync(UPLOADS_DIR, { recursive: true });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const projectId = formData.get('project_id') as string;

		if (!file) {
			throw error(400, 'No file uploaded');
		}

		// Generate unique filename
		const timestamp = Date.now();
		const originalName = file.name;
		const filename = `${timestamp}-${originalName}`;
		const filepath = join(UPLOADS_DIR, filename);

		// Convert file to buffer and save
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		
		writeFileSync(filepath, buffer);

		// Return file info
		return json({
			id: timestamp, // Use timestamp as temporary ID
			project_id: projectId ? parseInt(projectId) : null,
			filename: originalName,
			filepath: filename,
			file_type: file.type,
			uploaded_at: new Date().toISOString()
		});

	} catch (err) {
		console.error('Upload error:', err);
		if (err instanceof Response) {
			throw err;
		}
		throw error(500, 'Upload failed');
	}
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		}
	});
};