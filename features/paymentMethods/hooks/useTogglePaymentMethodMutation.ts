"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";
import { useAuthStore } from "@/store/authStore";
import type { PaymentMethodStatus } from "../types";

export function useTogglePaymentMethodMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      id,
      currentStatus,
      name,
    }: {
      id: string;
      currentStatus: PaymentMethodStatus;
      name: string;
    }) => {
      if (!user) throw new Error("غير مصرح");
      return paymentMethodService.toggleStatus(id, currentStatus, name, user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all() });
    },
  });
}
