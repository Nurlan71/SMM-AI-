// Simple time ago function
const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
];

const labels: { [key: string]: { one: string, few: string, many: string } } = {
    year: { one: 'год', few: 'года', many: 'лет' },
    month: { one: 'месяц', few: 'месяца', many: 'месяцев' },
    day: { one: 'день', few: 'дня', many: 'дней' },
    hour: { one: 'час', few: 'часа', many: 'часов' },
    minute: { one: 'минуту', few: 'минуты', many: 'минут' },
    second: { one: 'секунду', few: 'секунды', many: 'секунд' }
};

const getPlural = (count: number, label: { one: string, few: string, many: string }): string => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return label.many;
    }
    if (lastDigit === 1) {
        return label.one;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return label.few;
    }
    return label.many;
};

export function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) {
        return 'только что';
    }

    const interval = intervals.find(i => i.seconds < seconds);
    if (!interval) return 'только что';

    const count = Math.floor(seconds / interval.seconds);
    const pluralLabel = getPlural(count, labels[interval.label]);

    return `${count} ${pluralLabel} назад`;
}
