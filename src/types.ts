export type ClassType<T> = {
	new (...args: any[]): T // eslint-disable-line @typescript-eslint/no-explicit-any
}
