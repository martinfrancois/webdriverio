import { STACKTRACE_FILTER_FN } from './constants'

/**
 * Cleanup stack traces, merge and remove duplicates
 * @param {Error|*} commandError    Error object or anything else including undefined
 * @param {Error}   savedError      Error with root stack trace
 * @returns {Error}
 */
export function sanitizeErrorMessage (commandError: Error | any, savedError: Error): Error {
    let name, stack, message
    if (commandError instanceof Error) {
        ({ name, message, stack } = commandError)
    } else {
        name = 'Error'
        message = commandError
    }

    const err = new Error(message)
    err.name = name

    let stackArr: string | string[] | undefined = savedError.stack

    if (stackArr) {
        stackArr = stackArr.split('\n')
    }

    /**
     * merge stack traces if `commandError` has stack trace
     */
    if (stack) {
        // remove duplicated error name from stack trace
        stack = stack.replace(`${err.name}: ${err.name}`, err.name)
        if (Array.isArray(stackArr)) {
            // remove first stack trace line from second stack trace
            stackArr[0] = '\n'
            // merge
            stackArr = [...stack.split('\n'), ...stackArr]
        }
    }

    err.stack = (stackArr as string[])
        // filter stack trace
        .filter(STACKTRACE_FILTER_FN)
        // remove duplicates from stack traces
        .reduce((acc: string, currentValue: string) => {
            return acc.includes(currentValue) ? acc : `${acc}\n${currentValue}`
        }, '')
        .trim()

    return err
}