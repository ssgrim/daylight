
function toLogObj(level, args) {
	// If first arg is an object with requestId, treat as context
	let ctx = {}
	let rest = args
	if (args.length && typeof args[0] === 'object' && args[0] && args[0].requestId) {
		ctx = args[0]
		rest = args.slice(1)
	}
	return JSON.stringify({
		level,
		time: new Date().toISOString(),
		...ctx,
		msg: rest.map(String).join(' ')
	})
}

export function info(...args) { console.log(toLogObj('info', args)) }
export function warn(...args) { console.warn(toLogObj('warn', args)) }
export function error(...args) { console.error(toLogObj('error', args)) }
