"use client";

import { useQuery } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";
import { useAuthStore } from "@/store/authStore";

export function usePaymentMethodsQuery() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: paymentMethodKeys.lists(),
    queryFn:  () => paymentMethodService.getAll(),
    enabled:  !!user,
  });
}
