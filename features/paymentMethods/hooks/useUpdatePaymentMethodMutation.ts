"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";
import { useAuthStore } from "@/store/authStore";
import type { UpdatePaymentMethodInput } from "../schemas/paymentMethod.schema";

export function useUpdatePaymentMethodMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      id,
      data,
      before,
    }: {
      id: string;
      data: UpdatePaymentMethodInput;
      before: Record<string, unknown>;
    }) => {
      if (!user) throw new Error("غير مصرح");
      return paymentMethodService.update(id, data, user, before);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.lists() });
    },
  });
}
