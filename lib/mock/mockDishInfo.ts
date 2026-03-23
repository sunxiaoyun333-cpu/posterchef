import type { DishInfo } from '@/lib/types';

export const MOCK_DISH_INFO: DishInfo = {
  name: '宫保鸡丁',
  nameEn: 'Kung Pao Chicken',
  cuisine: 'Sichuan',
  description: '经典川菜，鸡丁嫩滑，花生香脆，麻辣鲜香，微带甜酸',
  descriptionEn: 'Tender chicken cubes stir-fried with peanuts, dried chilies, and Sichuan peppercorns in a savory-sweet-spicy sauce',
  mainColors: ['#C84B2F', '#F5A623', '#4A3728'],
  ingredients: ['鸡胸肉', '花生米', '干辣椒', '花椒', '葱姜蒜', '黄瓜丁'],
  lightingDirection: 'top',
  shootingAngle: '45deg',
  servingVessel: 'white round plate with red trim',
  confidence: 0.96,
  tags: ['辣', '川菜', '经典'],
};
