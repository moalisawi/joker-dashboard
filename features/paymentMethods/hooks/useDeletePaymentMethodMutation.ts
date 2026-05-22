"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";
import { useAuthStore } from "@/store/authStore";

export function useDeletePaymentMethodMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => {
      if (!user) throw new Error("غير مصرح");
      return paymentMethodService.remove(id, name, user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all() });
    },
  });
}
