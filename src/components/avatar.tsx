import { initials } from "@/lib/constants";
import { cn } from "@/lib/utils";

type P = { name: string; color: string; isMe?: boolean };

export function Avatar({ person, size = 32, className, ring = false }: { person: P; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      title={person.name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#17120e] select-none",
        ring && "ring-2 ring-card",
        className,
      )}
      style={{ width: size, height: size, background: person.color, fontSize: Math.max(10, size * 0.38) }}
    >
      {size < 30 ? initials(person.name).slice(0, 1) : initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 26 }: { people: P[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.name + i} person={p} size={size} ring className={i ? "-ml-1.5" : ""} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-1.5 inline-grid place-items-center rounded-full bg-secondary text-[0.65rem] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
