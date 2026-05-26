"use client";

import { useSubscriberCardStore } from "@/store/subscriberCardStore";
import type { Subscriber } from "@/types";

interface Props {
  subscriber: Subscriber;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a subscriber name as a clickable chip.
 * Clicking opens the SubscriberQuickCard overlay.
 */
export default function SubscriberNameChip({ subscriber, className = "", style }: Props) {
  const open = useSubscriberCardStore((s) => s.open);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(subscriber); }}
      className={`transition-colors hover:text-indigo-600 cursor-pointer text-right font-semibold ${className}`}
      style={{ lineHeight: 1.3, ...style }}
    >
      {subscriber.name}
    </button>
  );
}
