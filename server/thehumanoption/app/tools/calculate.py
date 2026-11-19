import ast
import asyncio
import math
import operator

from simpleeval import SimpleEval, InvalidExpression


def _bounded(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Only real numbers are supported.")
    if not math.isfinite(value) or abs(value) > 1e100:
        raise ValueError("The result is outside the calculator's range.")
    return value


def _power(left, right):
    if abs(right) > 100 or abs(left) > 1e10:
        raise ValueError("The exponent is outside the calculator's range.")
    return _bounded(left ** right)


def _evaluate(expression):
    if not expression or len(expression) > 256:
        raise ValueError("Use an expression of at most 256 characters.")
    tree = ast.parse(expression, mode="eval")
    nodes = list(ast.walk(tree))
    allowed = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Name, ast.Load,
               ast.Constant, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv,
               ast.Mod, ast.Pow, ast.UAdd, ast.USub)
    if len(nodes) > 80 or any(not isinstance(node, allowed) for node in nodes):
        raise ValueError("Only arithmetic and named math functions are supported.")
    for node in nodes:
        if isinstance(node, ast.Constant):
            _bounded(node.value)
        if isinstance(node, ast.Call) and (not isinstance(node.func, ast.Name) or len(node.args) > 2):
            raise ValueError("Unsupported function call.")
    operators = {
        ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod, ast.Pow: _power,
        ast.UAdd: operator.pos, ast.USub: operator.neg,
    }
    evaluator = SimpleEval(
        operators={key: (lambda *args, fn=fn: _bounded(fn(*args))) for key, fn in operators.items()},
        functions={name: getattr(math, name) for name in ("sqrt", "sin", "cos", "tan", "log", "log10", "floor", "ceil")},
        names={"pi": math.pi, "e": math.e},
    )
    return _bounded(evaluator.eval(expression))


async def calculate(expression: str) -> str:
    """Evaluate bounded arithmetic with sqrt, sin, cos, tan, log, log10, floor, ceil, pi and e."""
    try:
        result = await asyncio.wait_for(asyncio.to_thread(_evaluate, expression), timeout=1)
        return str(result)
    except (ArithmeticError, ValueError, SyntaxError, TypeError, TimeoutError, KeyError, InvalidExpression) as exc:
        return f"Calculation unavailable: {type(exc).__name__}. Use a short arithmetic expression."
