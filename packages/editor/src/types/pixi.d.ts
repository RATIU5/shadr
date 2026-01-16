declare module "pixi.js" {
	export class Application {
		stage: Container;
		renderer: Renderer;
		ticker: Ticker;
		init(options: {
			canvas: HTMLCanvasElement;
			resizeTo?: HTMLElement | Window;
			resolution?: number;
			autoDensity?: boolean;
		}): Promise<void>;
		destroy(): void;
	}

	export class Container {
		pivot: Point;
		position: Point;
		scale: Point;
		visible: boolean;
		alpha: number;
		eventMode?: "none" | "passive" | "auto" | "static" | "dynamic";
		cursor?: string;
		hitArea?: Rectangle;
		addChild<T extends Container>(child: T): T;
		toGlobal(
			position: { x: number; y: number },
			point?: Point,
			skipUpdate?: boolean,
		): Point;
		on(
			event: "pointerdown" | "pointerover" | "pointerout",
			fn: (event: FederatedPointerEvent) => void,
		): this;
		destroy(options?: { children?: boolean }): void;
	}

	export class Graphics extends Container {
		clear(): this;
		setStrokeStyle(style: LineStyleOptions): this;
		stroke(style?: LineStyleOptions): this;
		moveTo(x: number, y: number): this;
		lineTo(x: number, y: number): this;
		bezierCurveTo(
			cpX: number,
			cpY: number,
			cpX2: number,
			cpY2: number,
			toX: number,
			toY: number,
		): this;
		fill(style?: FillStyleOptions): this;
		rect(x: number, y: number, width: number, height: number): this;
		roundRect(
			x: number,
			y: number,
			width: number,
			height: number,
			radius: number,
		): this;
		circle(x: number, y: number, radius: number): this;
	}

	export class Text extends Container {
		constructor(options?: {
			text?: string;
			style?: TextStyleOptions;
		});
		text: string;
		width: number;
		height: number;
	}

	export class Rectangle {
		constructor(x: number, y: number, width: number, height: number);
		x: number;
		y: number;
		width: number;
		height: number;
	}

	export interface Renderer {
		screen: {
			width: number;
			height: number;
		};
	}

	export interface Ticker {
		add(fn: () => void): void;
	}

	export interface Point {
		x: number;
		y: number;
		set(x: number, y: number): void;
	}

	export interface FederatedPointerEvent {
		pointerId: number;
		stopPropagation(): void;
	}

	export interface LineStyleOptions {
		width?: number;
		color?: number;
		alpha?: number;
	}

	export interface FillStyleOptions {
		color?: number;
		alpha?: number;
	}

	export interface TextStyleOptions {
		fill?: number;
		fontFamily?: string;
		fontSize?: number;
	}
}
