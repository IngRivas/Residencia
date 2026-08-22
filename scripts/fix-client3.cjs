const fs = require('fs');
let c = fs.readFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', 'utf-8');

// Replace uniqueProveedores
c = c.replace(/const uniqueProveedores = useMemo\(\(\) => \{[\s\S]*?\}, \[initialGastos\]\)/, `const uniqueContratistas = useMemo(() => {
    const conts = initialGastos.map(g => g.contratista).filter(Boolean)
    return Array.from(new Set(conts)).sort((a, b) => a.localeCompare(b))
  }, [initialGastos])`);

// Replace form state
const formStateRegex = /const \[concepto, setConcepto\][\s\S]*?const \[notaCapturista, setNotaCapturista\] = useState<string>\(""\)/;
c = c.replace(formStateRegex, `const [periodo, setPeriodo] = useState<string>("")
  const [trabajoRealizado, setTrabajoRealizado] = useState<string>("")
  const [contratista, setContratista] = useState<string>("")
  const [total, setTotal] = useState<string>("")`);

// Replace subNum parse
c = c.replace(/const subNum = parseCurrency\(subtotal\)/, 'const totalNum = parseCurrency(total)');

// Replace handleSubmit logic
const submitRegex = /const handleSubmit = \(e: React\.FormEvent\) => \{[\s\S]*?setIsDeleteDialogOpen\(false\)\n\s*\}/;
c = c.replace(submitRegex, `const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!obraId) {
      sileo.error({ title: "Selecciona una obra" })
      return
    }
    if (!fechaStr) {
      sileo.error({ title: "Selecciona la fecha del pago" })
      return
    }

    if (!obras.some(o => o.nombre === obraId.trim()) && !customObras.includes(obraId.trim())) {
      setCustomObras(prev => [...prev, obraId.trim()]);
    }
    if (!trabajoRealizado.trim()) {
      sileo.error({ title: "Ingresa el trabajo realizado" })
      return
    }
    if (totalNum <= 0) {
      sileo.error({ title: "El total debe ser mayor a 0" })
      return
    }

    startTransition(async () => {
      const res = await createContratistaGastoFromModule({
        obraNombre: obraId,
        fechaStr,
        periodo,
        trabajoRealizado,
        contratista: contratista || "N/A",
        total: totalNum,
      })

      if (res.success) {
        sileo.success({ title: "Pago registrado exitosamente" })
        setTrabajoRealizado("")
        setPeriodo("")
        setContratista("")
        setTotal("")
      } else {
        sileo.error({ title: res.error || "Error al registrar pago" })
      }
    })
  }

  const handleDelete = async () => {
    if (!gastoToDelete) return
    startTransition(async () => {
      const res = await deleteContratistaGastoFromModule(gastoToDelete.id)
      if (res.success) {
        sileo.success({ title: "Gasto eliminado exitosamente" })
      } else {
        sileo.error({ title: res.error || "Error al eliminar gasto" })
      }
      setIsDeleteDialogOpen(false)
    })
  }`);

// Replace the JSX form
const formJsxRegex = /\{\/\* Inline Create Form \*\/\}\n\s*<div className="rounded-3xl bg-card\/70 p-4 shadow-lg backdrop-blur-xl">[\s\S]*?<\/form>\n\s*<\/div>/;

c = c.replace(formJsxRegex, `{/* Inline Create Form */}
      <div className="rounded-3xl bg-card/70 p-4 shadow-lg backdrop-blur-xl">
        <form id="registro-gasto-form" onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
          
          {/* Obra */}
          <ComboboxInput
            label="Obra"
            value={obraId}
            onChange={setObraId}
            options={[...obras.map(o => o.nombre), ...customObras]}
            className="flex-[1_1_200px]"
            required
          />

          {/* Fecha */}
          <div className="space-y-1.5 flex flex-col w-[160px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-2xl border-none bg-muted/60 px-3 py-2 text-xs text-foreground hover:bg-muted focus:ring-1 focus:ring-ring h-[36px]",
                    !fechaStr && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {fechaStr ? format(new Date(fechaStr + "T12:00:00"), "dd/MM/yyyy", { locale: es }) : <span>Fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-border/50 bg-card shadow-2xl backdrop-blur-xl" align="start">
                <Calendar
                  mode="single"
                  selected={fechaStr ? new Date(fechaStr + "T12:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) setFechaStr(date.toISOString().split("T")[0])
                  }}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Periodo */}
          <div className="space-y-1.5 w-[160px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Periodo</Label>
            <Input
              type="text"
              placeholder="01 ENE - 07 ENE"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full"
            />
          </div>

          {/* Contratista */}
          <ComboboxInput
            label="Contratista"
            value={contratista}
            onChange={setContratista}
            options={uniqueContratistas}
            placeholder="Jacobo Callejas..."
            className="flex-[1_1_200px]"
          />

          {/* Trabajo Realizado */}
          <div className="space-y-1.5 flex-[2_2_300px]">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Trabajo Realizado</Label>
            <Input
              type="text"
              placeholder="Descripción del trabajo..."
              value={trabajoRealizado}
              onChange={(e) => setTrabajoRealizado(e.target.value)}
              className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full"
              required
            />
          </div>

          {/* Total */}
          <div className="space-y-1.5 w-[140px] shrink-0">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Total ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">$</span>
              <Input
                type="text"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(formatCurrencyInput(e.target.value))}
                className="rounded-2xl bg-muted/60 text-xs h-[36px] border-none w-full pl-6"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            form="registro-gasto-form"
            disabled={isPending}
            size="icon"
            className="h-[36px] w-[36px] rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
            title="Registrar Pago"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>`);

// Change delete dialog text
c = c.replace(/el gasto "\$\{gastoToDelete\?\.concepto\}"/, `el pago por "\${gastoToDelete?.trabajoRealizado}"`);

fs.writeFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', c);
console.log("Success");
