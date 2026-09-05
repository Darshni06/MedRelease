import { AlertTriangle } from "lucide-react";

export default function ErrorState({ message = "Something went wrong." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-6 py-10 text-center">
      <AlertTriangle size={24} className="text-rose-500" />
      <p className="text-sm text-rose-700">{message}</p>
    </div>
  );
}
