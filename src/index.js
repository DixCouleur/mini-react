const MReact = require('./MReact')

const log = console.log.bind(console)

/** @jsx MReact.createElement */
const Counter = function() {
    const [count, setCount] = MReact.useState(1)

    const handleClick = function() {
        log('count', count)
        setCount(count + 1)
    }

    return (
        <h1 onClick={handleClick} style={{
            cursor: 'pointer',
            userSelect: 'none',
        }}>
            Count: {count}
        </h1>
    )
}

const element = <Counter />
const container = document.getElementById('root')
MReact.render(element, container)
