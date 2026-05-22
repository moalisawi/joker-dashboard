"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Send, ChevronDown } from "lucide-react";
import { useAddNote }     from "@/features/subscriberNotes/hooks/useNoteMutations";
import { NOTE_TYPE, NOTE_TYPE_LABELS, NOTE_TYPE_COLORS } from "@/constants/subscriberWorkflow";
import type { NoteType } from "@/constants/subscriberWorkflow";

const schema = z.object({
  content:  z.string().min(1, "النص مطلوب").max(1000),
  noteType: z.enum(Object.values(NOTE_TYPE) as [NoteType, ...NoteType[]]),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  subscriberId:   string;
  subscriberName: string;
  onSuccess?:     () => void;
}

export default function AddNoteForm({ subscriberId, subscriberName, onSuccess }: Props) {
  const addNote   = useAddNote();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { content: "", noteType: NOTE_TYPE.GENERAL },
  });

  async function onSubmit(data: FormValues) {
    setError(null);
    try {
      await addNote.mutateAsync({
        subscriberId,
        subscriberName,
        content:  data.content,
        noteType: data.noteType,
      });
      reset();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {/* Note type selector */}
      <div className="flex flex-wrap gap-2">
        <Controller
          name="noteType"
          control={control}
          render={({ field }) => (
            <>
              {(Object.values(NOTE_TYPE) as NoteType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => field.onChange(type)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: field.value === type ? `${NOTE_TYPE_COLORS[type]}20` : "var(--surface-2)",
                    color:      field.value === type ? NOTE_TYPE_COLORS[type] : "var(--text-muted)",
                    border:     `1.5px solid ${field.value === type ? NOTE_TYPE_COLORS[type] : "var(--border)"}`,
                  }}
                >
                  {NOTE_TYPE_LABELS[type]}
                </button>
              ))}
            </>
          )}
        />
      </div>

      {/* Text area */}
      <div className="relative">
        <textarea
          {...register("content")}
          rows={3}
          placeholder="اكتب ملاحظتك هنا…"
          className="form-input resize-none w-full text-sm"
          style={{ paddingLeft: "2.75rem" }}
        />
        <button
          type="submit"
          disabled={addNote.isPending}
          className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg text-white disabled:opacity-50 transition-opacity"
          style={{ background: "linear-gradient(135deg,#83A2DB,#9DB4D6)" }}
          title="إرسال"
        >
          <Send size={14}/>
        </button>
      </div>

      {errors.content && (
        <p className="text-xs text-rose-500">{errors.content.message}</p>
      )}
      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}
    </form>
  );
}
