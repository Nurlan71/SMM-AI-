export const getMonthName = (monthIndex: number): string => {
    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    return monthNames[monthIndex];
};

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
}

export const getDaysInMonth = (year: number, month: number): CalendarDay[] => {
    const date = new Date(year, month, 1);
    const days: CalendarDay[] = [];

    // --- Fill days from previous month ---
    // getDay() returns 0 for Sunday, 1 for Monday, etc. We want Monday to be 0.
    let firstDayOfWeek = date.getDay();
    if (firstDayOfWeek === 0) firstDayOfWeek = 6; // Sunday
    else firstDayOfWeek -= 1; // Monday is now 0

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek; i > 0; i--) {
        days.push({
            date: new Date(year, month - 1, prevMonthLastDay - i + 1),
            isCurrentMonth: false
        });
    }

    // --- Fill days of current month ---
    while (date.getMonth() === month) {
        days.push({
            date: new Date(date),
            isCurrentMonth: true
        });
        date.setDate(date.getDate() + 1);
    }
    
    // --- Fill days from next month to complete the grid ---
    const lastDayOfWeek = days[days.length - 1].date.getDay();
    // We want Sunday (0) to be the last day, so 7.
    const daysToFill = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    
    for (let i = 1; i <= daysToFill; i++) {
        days.push({
            date: new Date(year, month + 1, i),
            isCurrentMonth: false
        });
    }

    // Ensure the grid has 6 rows (42 days) for consistent layout
    while (days.length < 42) {
        const lastDate = days[days.length - 1].date;
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1);
        days.push({
            date: nextDate,
            isCurrentMonth: false
        });
    }


    return days;
};
