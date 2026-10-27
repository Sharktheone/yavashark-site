---
title: "Yavashark: I've Built A JS Engine Every Day For 950 Days Straight"
description: Announcing Yavashark, a small embeddable and easily extendable JavaScript engine that passes 82% of test262 with support for Temporal, Intl and React/TS.
date: 2026-10-28
---

Today I am announcing Yavashark, a small embeddable and easily extendable JavaScript engine that passes 82% of test262 with support for Temporal, Intl and React/TS.

I've built on it every single day since March 17, 2024 as a side project. I'm still the only contributor, but I am accepting contributions! So far I've made over 4200 commits to the engine repo.

Despite that number, the engine is still far from complete, but it can already run many JavaScript programs.

First of all, feel free to try it out on the playground directly at https://yavashark.dev/ !

# Present Status

Today the engine passes around 82% of the test262 test suite and I'm committed to pushing that even higher.

Already implemented are Temporal via Boa's amazing temporal_rs crate (which is also used in Google's V8) and Intl via the icu4x crate.
There are, however, many other features still missing or only half-implemented.

Yavashark is currently blazingly ~~fast~~ slow. But factoring in the amount of actual optimizations present, it is quite acceptable in terms of speed!
The engine has no hidden classes, inline caches, NaN-boxing, efficient object layout or a fast bytecode. In fact, it mostly uses a tree-walking interpreter plus a bytecode for async/await (but it has many missing features).

Yavashark's CLI can even already run TypeScript and React with TypeScript, including the full react and react-dom libraries (demos available in the engine repo).

Extending Yavashark is very easy. One can just bind Rust functions and methods to JavaScript via a macro, making it really easy to extend the engine with custom capabilities.
The engine can be compiled with experimental features which include a TCP and HTTP API, a filesystem and I/O API and some early timer work.
All of these are intentionally very small, though I am open to anyone wanting to make them more mature.

Here is a small example of the engine's fs API:

```rust
// Define `Fs` as an Object
#[object]
#[derive(Debug)]
pub struct Fs {}


#[properties_new(raw)]
impl Fs {
    fn open(path: &str) -> Res<String> {
        let contents = fs::read_to_string(path) // open and read the contents of that file
            .map_err(|e| Error::new_error(e.to_string()))?; // convert error and propagate as a JS-exception

        Ok(contents)
    }
}
```

After binding the object with some small binding glue to the engine's global object, you can just do the following in JavaScript:

```js
let script = Fs.open("foo.js")

eval(script)
```

More embedding examples can also be found [in the engine's repo in the examples dir](https://github.com/Sharktheone/yavashark/tree/main/examples) and the React demo [in the demos dir](https://github.com/Sharktheone/yavashark/tree/main/demos/react-ssr)


# Roadmap

Yavashark will be getting a lot of optimizations in the future, mostly the ones missing from above, but also a new Garbage Collector (GC) which will also be usable for the rest of the Rust ecosystem. Most current Rust GC's are very simple and single-threaded mark and sweep or cycle-collecting algorithms. A real high-performance GC is still missing.

The GC is planned to be a concurrent moving generational GC with fast memory allocation capabilities.

The new NaN-boxing and optimized object format mentioned above are already in the works and close to finalization.

Lastly, a new bytecode with inline caches and cheap dispatch will round off the initial performance improvements.

From these optimizations you should not expect a new V8-level engine, at least not for raw compute performance. In early testing, a prototype was able to consistently outperform V8's jitless mode in all microbenchmarks and in some even V8 with JIT enabled.

To give you a small sneak peek: across a set of 19 microbenchmarks, the prototype interpreter (with its new GC enabled) is on average about 3.5× faster than V8's jitless mode, and it beats it in every single one. In a few of them, like exceptions and generators, it even beats V8 with its JIT turned on. Mostely because V8 has to do some extra steps which the Yavashark doesn't need to.

However, take all of that with a big grain of salt, since integrating into the real engine might bring many more slowdowns.




# A Personal Note

These two and a half years have been incredibly fun and I've learned so many new things.

In the process of writing the engine I've joined Ecma's TC39 as an Invited Expert! Being under 20 years old, I am probably one of the youngest, if not the youngest, person in TC39.
Despite my young age, TC39 has been (and still is) a very welcoming community of incredible people!
The meetings are always very fun and interesting. I've met so many cool and inspiring people, making the meetings easily the most fun weeks of the year!

Lastly, I'd really appreciate it if you could give the [engine repo](https://github.com/Sharktheone/yavashark) a star on GitHub.
If you like the project, consider supporting me via GitHub Sponsors. With that you are helping a young girl pay her university bills!

Now it's over to you, so I wish you a nice day, night or whatever time you are reading this, and don't forget to have some fun with the engine!
