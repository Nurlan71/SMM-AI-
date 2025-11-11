import { Post } from '../types';

export const MOCK_UNSCHEDULED_POSTS: Post[] = [
  { id: 'idea1', platform: 'Instagram', content: 'Идея для поста про осенний марафон фотографий.', media: [], status: 'idea', tags: ['фото', 'осень'] },
  { id: 'idea2', platform: 'Telegram', content: 'Черновик статьи о новых трендах в SMM.', media: [], status: 'idea', tags: ['smm', 'тренды'] },
];

export const MOCK_SCHEDULED_POSTS: Post[] = [
  { id: 'post1', platform: 'VK', content: 'Завтра выходит наш новый продукт! Следите за анонсами.', media: ['/placeholder.jpg'], status: 'scheduled', publishDate: new Date(Date.now() + 86400000).toISOString(), tags: ['анонс', 'продукт'] },
  { id: 'post2', platform: 'Instagram', content: 'Пост о преимуществах нашего сервиса.', media: ['/placeholder.jpg'], status: 'scheduled', publishDate: new Date(Date.now() + 172800000).toISOString(), tags: ['сервис', 'преимущества'] },
];
