import logger from '@wdio/logger'
import WDIOReporter from '../../wdio-reporter/build'
import SuiteStats from '../../wdio-reporter/build/stats/suite'
import TestStats from '../../wdio-reporter/build/stats/test'
import CustomReporterResult = jasmine.CustomReporterResult

const log = logger('@wdio/jasmine-framework')

const STACKTRACE_FILTER = /(node_modules(\/|\\)(\w+)*|@wdio\/sync\/(build|src)|- - - - -)/g

interface JasmineReporterParams {
    cleanStack: boolean
    cid: string
    capabilities: any
    specs: any
}

export default class JasmineReporter implements jasmine.CustomReporter {
    private cid: string;
    private capabilities: any;
    private specs: any;
    private shouldCleanStack: any;
    private parent: any[];
    private failedCount: number;
    private startedTest: null;
    private startedSuite: SuiteStats | null;
    private reporter: WDIOReporter;
    private suiteStart: Date | null = null;
    private testStart: Date | null = null;

    constructor (reporter: WDIOReporter, params: JasmineReporterParams) {
        this.reporter = reporter

        this.cid = params.cid
        this.capabilities = params.capabilities
        this.specs = params.specs
        this.shouldCleanStack = typeof params.cleanStack === 'boolean' ? params.cleanStack : true
        this.parent = []
        this.failedCount = 0
        this.startedTest = null
        this.startedSuite = null
    }

    suiteStarted (suite: SuiteStats & CustomReporterResult) {
        this.suiteStart = new Date()
        suite.type = 'suite'
        suite.start = new Date()

        this.startedSuite = suite
        this.emit('suite:start', suite)
        this.parent.push({
            description: suite.description,
            id: suite.id,
            tests: 0
        })
    }

    specStarted (test: TestStats & CustomReporterResult) {
        this.testStart = new Date()
        test.type = 'test'
        test.start = new Date()
        const parentSuite = this.parent[this.parent.length - 1]

        /**
         * if jasmine test has no root describe block, create one
         */
        if (!parentSuite) {
            log.warn(
                'No root suite was defined! This can cause reporters to malfunction. ' +
                'Please always start a spec file with describe("...", () => { ... }).'
            )
        } else {
            parentSuite.tests++
        }

        this.emit('test:start', test)
    }

    specDone (test: TestStats & CustomReporterResult) {
        /**
         * excluded tests are treated as pending tests
         */
        if (test.status === 'excluded') {
            test.status = 'pending'
        }

        if (test.failedExpectations?.length) {
            let errors = test.failedExpectations
            if (this.shouldCleanStack) {
                errors = test.failedExpectations.map(x => this.cleanStack(x))
            }
            test.errors = errors
            // We maintain the single error property for backwards compatibility with reporters
            // However, any reporter wanting to make use of Jasmine's 'soft assertion' type expects
            // should default to looking at 'errors' if they are available
            test.error = errors[0]
        }

        const e = 'test:' + test.status?.replace(/ed/, '')
        test.type = 'test'
        test.duration = new Date() - this.testStart // TODO F
        this.emit(e, test)
        this.failedCount += test.status === 'failed' ? 1 : 0
        this.emit('test:end', test)
    }

    suiteDone (suite: SuiteStats & CustomReporterResult) {
        const parentSuite = this.parent[this.parent.length - 1]

        /**
         * in case there is a runtime error within one of the specs
         * create an empty test to attach the error to it
         */
        if (parentSuite.tests === 0 && suite.failedExpectations?.length) {
            const id = 'spec' + Math.random()
            // TODO F
            this.specStarted({
                id,
                description: '<unknown test>',
                fullName: '<unknown test>',
                start: new Date(Date.now())
            })
            this.specDone({
                id,
                description: '<unknown test>',
                fullName: '<unknown test>',
                failedExpectations: suite.failedExpectations,
                start: new Date(Date.now()),
                status: 'failed'
            })
        }

        this.parent.pop()
        suite.type = 'suite'
        suite.duration = new Date() - this.suiteStart // TODO F
        this.emit('suite:end', suite)
        this.startedSuite = null
    }

    emit (event, payload) {
        let message = {
            cid: this.cid,
            uid: this.getUniqueIdentifier(payload),
            event: event,
            title: payload.description,
            fullTitle: payload.fullName,
            pending: payload.status === 'pending',
            pendingReason: payload.pendingReason,
            parent: this.parent.length ? this.getUniqueIdentifier(this.parent[this.parent.length - 1]) : null,
            type: payload.type,
            // We maintain the single error property for backwards compatibility with reporters
            // However, any reporter wanting to make use of Jasmine's 'soft assertion' type expects
            // should default to looking at 'errors' if they are available
            error: payload.error,
            errors: payload.errors,
            duration: payload.duration || 0,
            specs: this.specs,
            start: payload.start,
        }

        this.reporter.emit(event, message)
    }

    getFailedCount () {
        return this.failedCount
    }

    getUniqueIdentifier (target) {
        return target.description + target.id
    }

    cleanStack (error) {
        if (!error.stack) {
            return error
        }

        let stack = error.stack.split('\n')
        stack = stack.filter((line) => !line.match(STACKTRACE_FILTER))
        error.stack = stack.join('\n')
        return error
    }
}
