'use client'

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SwipeBack } from "@/components/ui/swipe-back";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter()
  return (
    <SwipeBack>
      <div className="mobile-setting-screen flex h-full w-full flex-col overflow-y-auto bg-background pt-14">
        <div className="fixed left-0 right-0 top-0 z-10 flex items-center border-b border-border/60 bg-background/70 p-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
        </div>
        <div className="mx-auto w-full max-w-5xl flex-1 p-3">
          {children}
        </div>
      </div>
    </SwipeBack>
  )
}
