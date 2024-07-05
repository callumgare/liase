'use server'

import { kv } from '@vercel/kv';
import { GenericResponse } from "media-finder"
import style from "./page.module.css";
import MediaPreview from "./MediaPreview";

export default async function Page({ params }: { params: { id: string } }) {
  async function loadOutput(id: string): Promise<GenericResponse | null> {
    return kv.get<GenericResponse>(id);
  }
  const output = await loadOutput(params.id)

  return <div className={style.root}>
    <ul>
      {output?.media.map(media => (
        <li key={media.id}><MediaPreview media={media} /></li>
      ))}
    </ul>
    <details>
      <summary>Raw output</summary>
      <pre>{JSON.stringify(output, null, 2)}</pre>
    </details>
  </div>
}