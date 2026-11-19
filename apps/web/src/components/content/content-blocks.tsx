import { parseContentBlocks } from '@obgyn/types';

/**
 * Renders a content page's light Markdown (## / ### headings, - lists,
 * paragraphs). Shared by the public page and the admin editor's preview, so
 * the preview shows exactly what visitors will see. Text only, never HTML.
 */
export function ContentBlocks({ body }: { body: string }) {
  const blocks = parseContentBlocks(body);
  return (
    <div className="flex flex-col gap-5 leading-7">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return block.level === 2 ? (
            <h2 key={index} className="mt-3 text-xl font-semibold">{block.text}</h2>
          ) : (
            <h3 key={index} className="mt-2 text-lg font-semibold">{block.text}</h3>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="list-disc space-y-2 ps-6">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ul>
          );
        }
        return <p key={index} className="whitespace-pre-wrap">{block.text}</p>;
      })}
    </div>
  );
}
