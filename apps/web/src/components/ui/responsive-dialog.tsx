import { useEffect, useState, type ComponentProps } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { SheetContent, SheetFooter } from "./sheet";

/**
 * Renders as a centered modal on `≥ md` viewports and slides up from the
 * bottom as a Sheet on phones. Both share the same Radix Dialog Root, so
 * `open`/`onOpenChange` work identically.
 *
 * Usage:
 *   <ResponsiveDialog open={open} onOpenChange={setOpen}>
 *     <ResponsiveDialogContent>
 *       <ResponsiveDialogHeader>
 *         <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
 *       </ResponsiveDialogHeader>
 *       ...
 *       <ResponsiveDialogFooter>...</ResponsiveDialogFooter>
 *     </ResponsiveDialogContent>
 *   </ResponsiveDialog>
 */

const BREAKPOINT_PX = 768;
const QUERY = `(max-width: ${BREAKPOINT_PX - 1}px)`;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isMobile;
}

export const ResponsiveDialog = Dialog;
export const ResponsiveDialogTitle = DialogTitle;
export const ResponsiveDialogDescription = DialogDescription;
export const ResponsiveDialogHeader = DialogHeader;

export function ResponsiveDialogContent({
  children,
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <SheetContent side="bottom" className={className} {...props}>
        {children}
      </SheetContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogFooter(props: ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile();
  return isMobile ? <SheetFooter {...props} /> : <DialogFooter {...props} />;
}
