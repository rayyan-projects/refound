import { Skeleton } from '../ui/Skeleton';

export function AnswerSkeleton() {
  return (
    <div aria-busy="true" className="rounded-lg border border-line bg-surface p-6 md:p-8">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}
