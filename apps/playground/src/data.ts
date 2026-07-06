/** 데모 상품 정적 데이터. 품절 2건 포함 — planted issue #2(품절 시각 구분)의 대상. */
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  soldOut: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "미니 기계식 키보드",
    category: "키보드",
    price: 129000,
    description: "68키 저소음 적축, 무선/유선 겸용.",
    soldOut: false,
  },
  {
    id: "p2",
    name: "무선 버티컬 마우스",
    category: "마우스",
    price: 59000,
    description: "손목 부담을 줄이는 57도 버티컬 그립.",
    soldOut: false,
  },
  {
    id: "p3",
    name: "4K 웹캠",
    category: "영상",
    price: 189000,
    description: "오토포커스 + 듀얼 마이크 내장.",
    soldOut: true,
  },
  {
    id: "p4",
    name: "USB-C 도킹 스테이션",
    category: "허브",
    price: 239000,
    description: "듀얼 4K 출력, 100W PD 패스스루.",
    soldOut: false,
  },
  {
    id: "p5",
    name: "노이즈캔슬링 헤드폰",
    category: "오디오",
    price: 359000,
    description: "하이브리드 ANC, 40시간 재생.",
    soldOut: true,
  },
  {
    id: "p6",
    name: "듀얼 모니터 암",
    category: "거치대",
    price: 99000,
    description: "32인치 2대 지원 가스 스프링 암.",
    soldOut: false,
  },
];
