"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import MemberManager from "./MemberManager"

interface AssignMembersModalProps {
  obraId: string
  obraNombre: string
  miembros: any[]
  availableUsers: any[]
}

export function AssignMembersModal({
  obraId,
  obraNombre,
  miembros,
  availableUsers,
}: AssignMembersModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full px-5 font-medium shadow-sm transition-all">
          Asignar Miembros
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Gestión de Miembros - ${obraNombre}`}
        className="max-h-[85vh] overflow-y-auto sm:max-w-[900px]"
      >
        <div className="mt-4">
          <MemberManager
            obraId={obraId}
            availableUsers={availableUsers}
            miembros={miembros}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
