import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title = "Are you sure?", message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>Confirm</Button>
      </div>
    </Modal>
  );
}
