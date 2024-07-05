import { kv } from '@vercel/kv';

export async function POST(request: Request) {
    const requestUrl = new URL(request.url)
    const output = await request.json()
    const id = Date.now() + "-" + Math.floor(Math.random() * 10000)

    await kv.set(id, output, { ex: 5 * 60, nx: true });

    const outputViewerUrl = new URL(`/view/${id}`, requestUrl.origin)
    return Response.json({ viewerUrl: outputViewerUrl.href })
}