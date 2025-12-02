/**
 * API Route for OCR Processing
 * Handles image text extraction for lore content
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  getAllSourceImages,
  getUnprocessedImages,
  processImageWithOpenAI,
  processAllImages,
  generateOCRReport,
  loadOCRIndex,
} from '@/lib/ocr';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'status') {
      const report = generateOCRReport();
      return NextResponse.json(report);
    } else if (action === 'unprocessed') {
      const unprocessed = getUnprocessedImages();
      return NextResponse.json({
        count: unprocessed.length,
        images: unprocessed.slice(0, 50), // Limit to 50 for response size
      });
    } else if (action === 'all-images') {
      const allImages = getAllSourceImages();
      return NextResponse.json({
        count: allImages.length,
        images: allImages,
      });
    } else if (action === 'index') {
      const index = loadOCRIndex();
      return NextResponse.json(index);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('OCR API GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve OCR data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, imagePath, maxImages } = body;

  try {
    if (action === 'process-single' && imagePath) {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          error: 'OpenAI API key not configured',
        }, { status: 500 });
      }

      const result = await processImageWithOpenAI(imagePath, openai);
      return NextResponse.json(result);
    } else if (action === 'process-batch') {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          error: 'OpenAI API key not configured',
        }, { status: 500 });
      }

      const results = await processAllImages(openai, maxImages || 10);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('OCR API POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process OCR request';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

