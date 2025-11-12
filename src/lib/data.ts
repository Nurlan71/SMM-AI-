import { Post } from '../types';

// Fix: Updated mock data to match the Post type.
// - Changed 'id' to be a number.
// - Changed 'platform' to be lowercase.
// - Added missing count properties.
export const MOCK_UNSCHEDULED_POSTS: Post[] = [
  { id: 1, platform: 'instagram', content: 'Идея для поста про осенний марафон фотографий.', media: [], status: 'idea', tags: ['фото', 'осень'], comments_count: 0, likes_count: 0, views_count: 0 },
  { id: 2, platform: 'telegram', content: 'Черновик статьи о новых трендах в SMM.', media: [], status: 'idea', tags: ['smm', 'тренды'], comments_count: 0, likes_count: 0, views_count: 0 },
];

export const MOCK_SCHEDULED_POSTS: Post[] = [
  { id: 3, platform: 'vk', content: 'Завтра выходит наш новый продукт! Следите за анонсами.', media: ['/placeholder.jpg'], status: 'scheduled', publishDate: new Date(Date.now() + 86400000).toISOString(), tags: ['анонс', 'продукт'], comments_count: 0, likes_count: 0, views_count: 0 },
  { id: 4, platform: 'instagram', content: 'Пост о преимуществах нашего сервиса.', media: ['/placeholder.jpg'], status: 'scheduled', publishDate: new Date(Date.now() + 172800000).toISOString(), tags: ['сервис', 'преимущества'], comments_count: 0, likes_count: 0, views_count: 0 },
];