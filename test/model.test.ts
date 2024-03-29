import {expect} from "chai";
import {tictactoe} from "./examples";
import {Dsl, DeclarationFunction, ModelType, newModel, PlaceNode, snapshot, TxNode} from "../";
import * as fs from "fs";

function testElementaryValid({fn, cell, role}: Dsl): {
    p1: PlaceNode;
    p2: PlaceNode;
    p3: PlaceNode;
    t1: TxNode;
} {
    const r = role("default");

    const p1 = cell("p0", 1, 1, {x: 100, y: 100});
    const t1 = fn("t1", r, {x: 200, y: 100});
    const p2 = cell("p2", 0, 1, {x: 300, y: 100});
    const p3 = cell("p3", 0, 1, {x: 300, y: 200});

    p1.tx(1, t1);
    t1.tx(1, p2);
    return {p1, t1, p2, p3};
}

function testElementaryInvalid({fn, cell, role}: Dsl): void {
    const base = testElementaryValid({fn, cell, role});
    base.t1.tx(1, base.p3); // add an extra output making this invalid
}

function testWorkflowValid({fn, cell, role}: Dsl): void {
    const r = role("default");
    const p1 = cell("p1", 1, 1, {x: 100, y: 100});
    const p2 = cell("p2", 0, 1, {x: 300, y: 100});

    const t1 = fn("t1", r, {x: 200, y: 100});

    // t1 can fire if either p1 or p2 is populated
    p1.tx(1, t1);
    p2.tx(1, t1);
}

function testModel({declaration, type}: {declaration: DeclarationFunction; type: ModelType }) {
    const m = newModel({
        declaration,
        type,
    });
    const state = m.initialVector();
    const trigger = (action: string, opts?: { expectPass?: boolean; expectFail?: boolean }) => {
        m.fire(state, action, 1,
            () => expect(!!opts?.expectPass).to.be.true,
            () => expect(!!opts?.expectFail).to.be.true,
        );
    };
    return {m, state, trigger};
}

describe("metamodel", () => {
    describe("petriNet", () => {
        it("should be able to play tic-tac-toe", () => {
            const m = newModel({declaration: tictactoe});
            expect(m.def.type).to.equal("petriNet");
            const state = m.initialVector();
            expect(m.emptyVector()).to.deep.equal([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            expect(state).to.deep.equal([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
            expect(m.capacityVector()).to.deep.equal([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

            m.fire(state, "X11", 1);
            expect(state).to.deep.equal([1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1]);
            m.fire(state, "O01", 1);
            expect(state).to.deep.equal([1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0]);
        });

        it("should still work for invalid elementary models", () => {
            const mm = testModel({declaration: testElementaryInvalid, type: ModelType.petriNet});


            mm.trigger("t1", {expectPass: true});
            mm.trigger("t1", {expectFail: true});
        });

    });

    describe("elementary", () => {
        it("should work for valid models", () => {
            const {trigger} = testModel({declaration: testElementaryValid, type: ModelType.elementary});
            trigger("t1", {expectPass: true});
            trigger("t1", {expectFail: true});
        });

        it("should not work for invalid models", () => {
            const {trigger} = testModel({declaration: testElementaryInvalid, type: ModelType.elementary});
            trigger("t1", {expectFail: true});
        });
    });

    describe("workflow", () => {
        it("should not work for invalid models", () => {
            const {trigger} = testModel({declaration: testElementaryInvalid, type: ModelType.workflow});
            trigger("t1", {expectFail: true});
        });
        it("should allow 'OR' input from two places to single transition", () => {
            const {trigger} = testModel({declaration: testWorkflowValid, type: ModelType.workflow});
            trigger("t1", {expectPass: true});
        });
    });
});

