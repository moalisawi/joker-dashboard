import { toast as sonner } from "sonner";

export const toast = {
  success: (msg: string)  => sonner.success(msg),
  error:   (msg: string)  => sonner.error(msg),
  warning: (msg: string)  => sonner.warning(msg),
  loading: (msg: string)  => sonner.loading(msg),
  dismiss: (id?: string | number) => sonner.dismiss(id),
  promise: sonner.promise,
};

/** Legacy one-shot helper — used by existing call sites. */
export function showToast(msg: string) {
  sonner.success(msg);
}
