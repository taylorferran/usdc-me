"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { WITHDRAWAL_CHAINS } from "@/lib/chains"
import * as api from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useIsMobile } from "@/hooks/use-mobile"

const schema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
  chain: z.string().min(1, "Select a destination chain"),
  recipient: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function WithdrawForm({ onSuccess }: { onSuccess: () => void }) {
  const { user, privateKey } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", chain: "arcTestnet", recipient: "" },
  })

  const { isSubmitting } = form.formState

  async function handleSubmit(values: FormValues) {
    if (!user?.address || !privateKey) {
      setError("Wallet not unlocked — please log in again")
      return
    }
    setError(null)
    try {
      const res = await api.withdraw({
        address: user.address,
        amount: values.amount,
        chain: values.chain,
        privateKey,
        recipient: values.recipient || undefined,
      })
      toast.success(
        `Withdrew ${res.amount} USDC to ${res.recipient.slice(0, 10)}… on ${res.destinationChain}`
      )
      form.reset()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {error && (
          <Alert className="border-destructive/50 text-destructive text-sm">
            {error}
          </Alert>
        )}

        <FormField
          control={form.control}
          name="chain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination chain</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select chain…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WITHDRAWAL_CHAINS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText className="text-sm font-medium">USDC</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recipient"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination address <span className="text-muted-foreground font-normal">(optional — blank = your wallet)</span></FormLabel>
              <FormControl>
                <Input
                  placeholder="0x… leave blank to withdraw to your own wallet"
                  autoComplete="off"
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              Withdrawing…
            </>
          ) : (
            <>
              Withdraw USDC
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
            </>

          )}
        </Button>
      </form>
    </Form>
  )
}

export function WithdrawModal() {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline">Withdraw</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Withdraw USDC</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <WithdrawForm onSuccess={() => setOpen(false)} />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Withdraw</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
        </DialogHeader>
        <WithdrawForm onSuccess={() => setOpen(false)} />
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
