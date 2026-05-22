"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";
import { useAuthStore } from "@/store/authStore";
import type { CreatePaymentMethodInput } from "../schemas/paymentMethod.schema";

export function useCreatePaymentMethodMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (data: CreatePaymentMethodInput) => {
      if (!user) throw new Error("غير مصرح");
      return paymentMethodService.create(data, user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all() });
    },
  });
}
