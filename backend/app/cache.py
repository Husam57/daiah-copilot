"""ذاكرة مؤقتة صغيرة في الذاكرة (LRU + مدة صلاحية)، آمنة مع الخيوط.

تُستخدم لـ: تضمين الأسئلة المتكررة، وتصنيفها، وجملة التوجيه، والمسارات العامة (60 ث)، والإعدادات.
كل نسخة من الخادم لها ذاكرتها (على Render نسخة واحدة)؛ لا تُخزَّن أي بيانات سرية.
"""
import threading
import time
from collections import OrderedDict
from functools import wraps
from typing import Any, Callable, Hashable

_MISSING = object()


class TTLCache:
    def __init__(self, maxsize: int, ttl: float, name: str = ""):
        self.maxsize, self.ttl, self.name = maxsize, ttl, name
        self._data: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = self.misses = 0

    def get(self, key: Hashable, default: Any = None) -> Any:
        with self._lock:
            item = self._data.get(key, _MISSING)
            if item is _MISSING or item[0] < time.monotonic():
                if item is not _MISSING:
                    del self._data[key]
                self.misses += 1
                return default
            self._data.move_to_end(key)
            self.hits += 1
            return item[1]

    def set(self, key: Hashable, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + self.ttl, value)
            self._data.move_to_end(key)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict:
        with self._lock:
            return {"name": self.name, "size": len(self._data), "hits": self.hits, "misses": self.misses,
                    "ttl": self.ttl, "maxsize": self.maxsize}


# ============ المسارات العامة ============
PUBLIC_TTL = 60.0
public_cache = TTLCache(maxsize=512, ttl=PUBLIC_TTL, name="public")


def cached_public(fn: Callable) -> Callable:
    """يخزن نتيجة مسار عام 60 ث حسب اسم الدالة ومعاملاتها. الأخطاء (404…) لا تُخزن.
    يُبطل كله عند أي تعديل في اللوحة (invalidate_public)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        key = (fn.__name__, args, tuple(sorted(kwargs.items())))
        value = public_cache.get(key, _MISSING)
        if value is _MISSING:
            value = fn(*args, **kwargs)
            public_cache.set(key, value)
        return value
    return wrapper


def invalidate_public() -> None:
    public_cache.clear()
