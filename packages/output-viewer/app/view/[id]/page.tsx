"use server";

import type { GenericResponse } from "@liason/core";
import { kv } from "@vercel/kv";
import MediaPreview from "./MediaPreview";
import style from "./page.module.css";

export default async function Page({ params }: { params: { id: string } }) {
  async function loadOutput(id: string): Promise<GenericResponse | null> {
    return kv.get<GenericResponse>(id);
  }
  const output = await loadOutput(params.id);

  return (
    <div className={style.root}>
      {output && (
        <ul>
          {output.media.map((media) => (
            <li key={media.id}>
              <MediaPreview media={media} />
            </li>
          ))}
        </ul>
      )}
      {!output && <div>No output find, possibly output has expired</div>}
      <details>
        <summary>Raw output</summary>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </details>
    </div>
  );
}
