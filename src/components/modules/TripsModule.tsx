import { Plane, Check } from "lucide-react";
import { format } from "date-fns";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Trip, HotelOption } from "@/lib/db/schema";

const STAGES: Trip["status"][] = ["requested", "approved", "booked", "confirmed"];

function StageProgress({ status }: { status: Trip["status"] }) {
  const currentIdx = STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px]",
              i <= currentIdx
                ? "border-pine bg-pine text-white"
                : "border-sage/40 text-sage"
            )}
          >
            {i <= currentIdx ? <Check className="size-3" /> : i + 1}
          </div>
          {i < STAGES.length - 1 && (
            <div className={cn("h-px w-4", i < currentIdx ? "bg-pine" : "bg-sage/30")} />
          )}
        </div>
      ))}
      <span className="ml-1.5 text-xs capitalize text-sage">{status}</span>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip & { hotelOptions: HotelOption[] } }) {
  const selectedHotel = trip.hotelOptions.find((h) => h.selected);
  return (
    <div className="rounded-xl border border-sand/30 bg-sand/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{trip.destination}</p>
          <p className="text-xs text-sage">
            {format(new Date(trip.startDate), "MMM d")} –{" "}
            {format(new Date(trip.endDate), "MMM d, yyyy")}
          </p>
        </div>
        <Badge tone="sand">
          {trip.purpose === "conference_plus_vacation" ? "conference + vacation" : "vacation"}
        </Badge>
      </div>
      <div className="mt-2">
        <StageProgress status={trip.status} />
      </div>
      {trip.hotelOptions.length > 0 && (
        <div className="mt-2 text-xs text-sage">
          {selectedHotel ? (
            <span>
              Staying at <span className="text-ink">{selectedHotel.name}</span>
            </span>
          ) : (
            <span>{trip.hotelOptions.length} hotel option(s) under consideration</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TripsModule({
  trips,
}: {
  trips: (Trip & { hotelOptions: HotelOption[] })[];
}) {
  const hasActive = trips.some((t) => t.status !== "confirmed");
  return (
    <ExpandableSection
      title="Vacation Planning"
      icon={<Plane className="size-4" />}
      accent="sand"
      defaultOpen={hasActive}
      badge={trips.length > 0 && <Badge tone="sand">{trips.length}</Badge>}
    >
      <div className="space-y-2.5">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
        {trips.length === 0 && <p className="text-sm text-sage">No trips planned.</p>}
      </div>
    </ExpandableSection>
  );
}
