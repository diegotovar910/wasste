import { statusMeta } from '../data/wasteCategories.js';

/**
 * Status is never colour alone: the shape marker and the written label carry
 * the meaning, colour only reinforces it.
 */
export function StatusBadge({ status, size = 'md' }) {
  const meta = statusMeta(status);
  const isSmall = size === 'sm';

  return (
    <span
      title={meta.note}
      className={`inline-flex items-center gap-1.5 rounded-full border border-hairline bg-inset font-medium text-ink ${
        isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span aria-hidden="true" style={{ color: meta.color }} className="text-[9px] leading-none">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}
