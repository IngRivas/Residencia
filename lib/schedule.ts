/**
 * Verifica si la hora actual del sistema se encuentra dentro de los horarios permitidos.
 * 
 * @param schedules Array de objetos con { start, end, days }. `days` es un array de números (0=Domingo, 6=Sábado).
 * @returns true si está dentro de horario o si no hay horarios definidos. false si está fuera de horario.
 */
export function checkIsWithinHours(schedules: any[] | null | undefined): boolean {
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    // Si no hay horarios definidos, se permite el acceso por defecto.
    return true;
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHours * 60 + currentMinutes;

  for (const schedule of schedules) {
    const { start, end, days } = schedule as any;
    
    // Check if current day is in this schedule's allowed days
    if (days && Array.isArray(days) && days.length > 0 && !days.includes(currentDay)) {
      continue;
    }

    if (!start || !end) {
      // If there are no start/end times defined but the day matched, consider it valid.
      return true;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    if (startTime <= endTime) {
      if (currentTime >= startTime && currentTime <= endTime) {
        return true;
      }
    } else {
      // Overnight schedule (e.g., 22:00 to 06:00)
      if (currentTime >= startTime || currentTime <= endTime) {
        return true;
      }
    }
  }

  // Si iteró todos los schedules y ninguno coincidió, entonces está fuera de horario
  return false;
}
