import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Creating your wallet…", value: 33 },
  { label: "Loading test USDC…", value: 66 },
  { label: "Setting up Gateway…", value: 100 },
]

interface RegistrationProgressProps {
  step: 0 | 1 | 2
}

export function RegistrationProgress({ step }: RegistrationProgressProps) {
  const current = STEPS[step]

  return (
    <div className="space-y-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <Spinner className="size-5 text-primary" />
        <span className="text-sm font-medium">{current.label}</span>
      </div>

      <Progress value={current.value} className="h-2" />

      <div className="flex justify-center gap-6">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              i <= step
                ? "text-primary font-medium"
                : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-primary border-2 text-primary"
                    : "border-muted-foreground/30 border text-muted-foreground/50"
              )}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label.split("…")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
