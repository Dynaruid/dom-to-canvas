# dom-to-canvas live canvas 리팩토링 작업 계획

## 목표

- 기존 one-shot 스냅샷 성격의 `toCanvas` 대신 live rendering을 위한 `getCanvas` API를 도입한다.
- 반환값은 단순 `HTMLCanvasElement`가 아니라 수명주기와 제어 메서드를 포함한 handle 객체로 설계한다.
- 기존 `toSvg`, `toPng`, `toJpeg`, `toBlob`, `toPixelData`, `copyPixelData`는 one-shot export API로 유지하되, 내부 구현은 새 렌더 세션 구조를 공용으로 사용하도록 정리한다.
- 전역 상태 기반 구현을 세션 단위 상태로 바꿔 동시 렌더링과 옵션 격리를 가능하게 만든다.
- React 패키지는 코어의 live handle 위에 얹는 얇은 래퍼로 재구성한다.

## 우선 결정

- `toCanvas`는 새 live API의 이름으로 쓰지 않는다.
- 새 API는 `getCanvas(node, options?)`로 시작한다.
- `getCanvas`의 반환형은 아래와 같은 handle로 잡는다.

```ts
interface CanvasHandle {
  readonly canvas: HTMLCanvasElement;
  readonly node: Node;
  readonly options: Options;
  readonly isRendering: boolean;
  readonly isRunning: boolean;
  readonly frame: number;

  render(options?: Options): Promise<HTMLCanvasElement>;
  start(): void;
  stop(): void;
  update(options: Options): void;
  resize(options?: Options): void;
  dispose(): void;
}
```

## 현재 구조에서 확인된 핵심 문제

1. 현재 코어는 `Renderer`가 지속형 canvas를 들고 있지만 실제 렌더 경로는 one-shot cleanup을 전제로 짜여 있다.
2. `options`, `urlCache`, `sandbox`, default-style cache가 전역 `state`에 묶여 있어 여러 렌더 세션이 서로 간섭할 수 있다.
3. `toSvg` 내부가 clone, font/image inline, option 적용, cleanup까지 모두 들고 있어 live 렌더링 수명주기를 끼워 넣기 어렵다.
4. React 패키지가 프레임 루프와 캡처 수명주기를 사실상 별도로 관리하고 있어 코어와 역할 경계가 어색하다.

## 리팩토링 원칙

- rename보다 lifecycle 분리를 우선한다.
- 전역 mutable state 제거를 최우선으로 둔다.
- one-shot API는 가능한 한 외부 시그니처를 유지한다.
- live rendering과 export rendering은 같은 렌더 파이프라인을 공유하되, 시작/정지/정리 책임만 분리한다.
- React 전용 개념은 코어에 직접 넣지 않는다. 코어는 프레임 구동이 가능한 handle만 제공하고, React는 이를 소비한다.

## 단계별 작업

### 1. 렌더 세션 컨텍스트 도입

- [x] `state.ts`의 전역 상태를 `RenderSession` 클래스로 분리
- [x] `options`, `urlCache`를 세션 소유로 이동
- [x] `copyImplOptions`, `clearUrlCache` 전역 함수들을 세션 메서드로 치환
- [x] `sandbox`, default-style cache는 document-global 공유로 유지 (성능)
- [x] `util.ts`, `sandbox.ts`, `clone.ts`, `images.ts`, `font-faces.ts`가 세션 컨텍스트를 인자로 받도록 정리

목표 결과:

- 같은 문서에서 여러 `getCanvas` handle과 one-shot export가 동시에 돌아도 상태 충돌이 없어야 한다.

### 2. 렌더 파이프라인 분해

- [x] `toSvg`에 뭉쳐 있는 clone/inline/apply/serialize/cleanup 로직을 `pipeline.ts`의 `buildSvgDataUri`로 분해
- [x] one-shot 경로와 live 경로가 같은 하위 파이프라인(`buildSvgDataUri`)을 사용하도록 정리

목표 결과:

- `toSvg`는 더 이상 전체 파이프라인의 오케스트레이터가 아니라 export 조합 함수 정도의 역할만 가져야 한다.

### 3. Renderer 역할 재정의

- [x] `Renderer`를 세션 기반 canvas owner로 재정의 (`session: RenderSession` 소유)
- [x] 내부 canvas 접근을 `canvas` getter로 공개
- [x] `measure`, `render`, `toPixelData`, `copyPixelData`, `toPng`, `toJpeg`, `toBlob`가 모두 같은 내부 `_draw` 결과를 공유
- [x] dispose 시 세션 cleanup(`clearUrlCache`) 포함

목표 결과:

- 코어에서 live handle과 one-shot export 모두 `Renderer`를 공통 기반으로 사용할 수 있어야 한다.

### 4. getCanvas handle 도입

- [x] `getCanvas(node, options?)` public API 추가
- [x] 최초 init 시점에 renderer와 session을 묶는 handle 생성
- [x] `render()`는 즉시 한 프레임 렌더
- [x] `start()`는 지속 렌더링 시작
- [x] `stop()`은 지속 렌더링 중단
- [x] `update(options)`는 다음 렌더부터 적용될 옵션 갱신
- [x] `dispose()`는 observer, raf, sandbox, cache 정리

핵심 판단:

- 반환값을 `Promise<CanvasHandle>`로 둘지 `CanvasHandle`로 둘지는 구현 중 결정하되, 초기 리소스 준비가 비동기라면 `Promise<CanvasHandle>`를 우선한다.

### 5. live invalidation 전략 구현

- [x] 기본 모드는 `dirty` 기반 자동 갱신으로 설계
- [x] `MutationObserver`로 DOM 구조/속성/텍스트 변경 감지
- [x] `ResizeObserver`로 크기 변경 감지
- [x] `requestAnimationFrame` 기반 렌더 루프
- [x] `mode: "continuous"` 옵션 추가
- [x] CSS animation/transition 처리 정책 결정

초기 제안:

- 기본값은 `dirty`
- CSS animation/transition은 dirty invalidation만으로는 프레임 추적되지 않으므로 `mode: "continuous"`를 사용한다

### 6. one-shot API 재구성

- [x] `toPng`, `toJpeg`, `toBlob`, `toPixelData`, `copyPixelData`, `toSvg`가 새 세션 구조를 사용
- [x] `toCanvas`는 deprecated alias로 정리
- [x] 문서와 실제 export 불일치 정리

정책 초안:

- 당장은 `toCanvas`를 deprecated alias로 남기고 내부적으로 one-shot `renderer.render()` 후 `canvas`를 반환하는 방식으로 두는 편이 마이그레이션에 유리하다.
- 충분히 안정화된 뒤 major 변경에서 제거한다.

### 7. React 패키지 정리

- [x] `DomFrame`이 코어의 세션 기반 Renderer를 내부적으로 사용
- [x] `useCanvasHandle` 훅 추가로 코어의 live handle을 React에서 직접 사용 가능
- [x] CanvasHandle 타입 re-export
- [ ] React 테스트를 코어 라이브 수명주기 기준으로 재작성

목표 결과:

- live rendering의 실질 구현은 코어에 있고, React는 구독과 생명주기 연결만 맡는다.

### 8. 테스트 보강

- [x] 세션 분리 테스트 추가
- [x] 동시 live handle 2개 이상 동작 테스트
- [x] `start` / `stop` / `dispose` 동작 테스트
- [x] 옵션 update 후 반영 테스트
- [x] one-shot API 회귀 테스트 (기존 toSvg 테스트 통과)
- [x] React 통합 테스트 통과 확인

특히 검증할 항목:

- dispose 후 sandbox나 offscreen SVG가 DOM에 남지 않는지
- 여러 세션이 서로의 `useCredentials`, `cacheBust`, `corsImg` 설정에 영향 주지 않는지
- 크기 변경 시 canvas resize와 렌더 결과가 함께 갱신되는지

### 9. 문서와 마이그레이션 정리

- [x] `README.md`와 패키지 README의 API 표 갱신
- [x] `getCanvas` 예제 추가
- [x] `toCanvas`의 상태를 deprecated 또는 removed로 명시
- [x] one-shot export와 live rendering의 차이를 설명
- [x] React 사용 예제도 새 구조 기준으로 갱신

## 예상 난점

- 세션 컨텍스트 주입 때문에 유틸 함수 시그니처 변경 범위가 넓다.
- sandbox와 default-style cache는 성능에 직접 영향을 주므로, 전역 제거 이후 캐시 전략을 다시 잡아야 한다.
- CSS animation을 완전 자동으로 잡으려면 dirty 전략만으로 부족할 수 있다.
- live rendering이 잦아지면 image/font inline 비용이 커지므로 재사용 가능한 중간 캐시 계층이 필요할 수 있다.

## 구현 순서 제안

1. 세션 컨텍스트 도입
2. 파이프라인 분해
3. Renderer 재정의
4. `getCanvas` handle 추가
5. invalidation/start-stop 구현
6. one-shot API 재연결
7. React 패키지 이전
8. 테스트/문서 정리

## 완료 기준

- `getCanvas`로 받은 handle에서 `canvas`, `render`, `start`, `stop`, `dispose`가 정상 동작한다.
- 최소 2개의 live handle을 동시에 생성해도 상태 간섭이 없다.
- 기존 one-shot export API가 회귀 없이 동작한다.
- React 패키지가 코어 live handle 위에서 정상 동작한다.
- 문서가 실제 export와 일치한다.
