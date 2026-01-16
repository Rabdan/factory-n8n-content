import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';

const UPLOADS_DIR = 'data/uploads';

export async function GET({ params }) {
	try {
		const filePath = join(UPLOADS_DIR, params.file);
		
		// Check if file exists
		const stats = statSync(filePath);
		if (!stats.isFile()) {
			throw error(404, 'File not found');
		}

		// Read file
		const file = readFileSync(filePath);
		
		// Get file extension for content type
		const ext = filePath.split('.').pop()?.toLowerCase();
		const contentType = getContentType(ext);

		return new Response(file, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
				'Content-Length': stats.size.toString()
			}
		});
	} catch (err) {
		console.error('Error serving file:', err);
		throw error(404, 'File not found');
	}
}

function getContentType(ext?: string): string {
	const types: Record<string, string> = {
		// Images
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'webp': 'image/webp',
		'svg': 'image/svg+xml',
		// Documents
		'pdf': 'application/pdf',
		'doc': 'application/msword',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'txt': 'text/plain',
		// Videos
		'mp4': 'video/mp4',
		'webm': 'video/webm',
		// Audio
		'mp3': 'audio/mpeg',
		'wav': 'audio/wav',
		// Default
		'bin': 'application/octet-stream'
	};

	return types[ext || ''] || types.bin;
}