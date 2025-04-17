import { Skeleton } from "@/components/ui/skeleton";

export function AppSkeleton() {
  return (
    <div className="w-full space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      
      {/* URL input skeleton */}
      <div className="flex gap-2 items-center">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      
      {/* Tabs skeleton */}
      <div className="flex border-b space-x-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      
      {/* Content area skeleton */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Video details skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-36 mb-4" />
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-6 w-full max-w-md" />
          <div className="flex items-center space-x-2 mt-4">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        
        {/* Download options skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-48 mb-4" />
          
          {/* Option buttons skeleton */}
          <div className="flex space-x-2 mb-6">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
          
          {/* Quality options skeleton */}
          <Skeleton className="h-6 w-36 mb-2" />
          <div className="flex flex-wrap gap-2 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-full" />
            ))}
          </div>
          
          {/* Format options skeleton */}
          <Skeleton className="h-6 w-72 mb-2" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}