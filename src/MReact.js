const utils = require('./utils')

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null
let wipFiber = null
let hookIndex = null

const createElement = function(type, props, ...children) {
    // Convert style object to style string
    const { style } = props
    if(typeof style === 'object') {
        props.style = Object.keys(style)
            .map(key => `${utils.camelCaseToDash(key)}: ${style[key]};`)
            .join('')
    }

    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child),
            ),
        },
    }
}

const createTextElement = function(text) {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: text,
            children: [],
        },
    }
}

const createDom = function(fiber) {
    const dom =
        fiber.type === 'TEXT_ELEMENT'
            ? document.createTextNode('')
            : document.createElement(fiber.type)

    updateDom(dom, {}, fiber.props)

    return dom
}

const isEvent = key => key.startsWith('on')
const isProperty = key => key !== 'children' && !isEvent(key)

const isNew = function(prev, next) {
    return function(key) {
        const isEqual = prev[key] !== next[key]
        return isEqual
    }
}

const isGone = function(prev, next) {
    return function(key) {
        return !(key in next)
    }
}

const updateDom = function(dom, prevProps, nextProps) {
    //Remove old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2)
            dom.removeEventListener(eventType, prevProps[name])
        })

    // Remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ''
        })

    // Set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })

    // Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2)
            dom.addEventListener(eventType, nextProps[name])
        })
}

const commitRoot = function() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

const commitWork = function(fiber) {
    if(!fiber) {
        return
    }

    let domParentFiber = fiber.parent
    while(!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if(fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
        domParent.appendChild(fiber.dom)
    } else if(fiber.effectTag === 'UPDATE' && fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if(fiber.effectTag === 'DELETION') {
        commitDeletion(fiber, domParent)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

const commitDeletion = function(fiber, domParent) {
    if(fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

const render = function(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
        alternate: currentRoot,
    }
    deletions = []
    nextUnitOfWork = wipRoot
}

const workLoop = function(deadline) {
    let shouldYield = false
    while(nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadline.timeRemaining() < 1
    }

    if(!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

const performUnitOfWork = function(fiber) {
    const isFunctionComponent = fiber.type instanceof Function
    if(isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    if(fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while(nextFiber) {
        if(nextFiber.sibling) {
            return nextFiber.sibling
        }

        nextFiber = nextFiber.parent
    }
}

const updateFunctionComponent = function(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

const useState = function(initial) {
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex]

    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    }

    const values = oldHook ? oldHook.queue : []
    values.forEach(v => {
        hook.state = v
    })

    const setState = value => {
        hook.queue.push(value)
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex += 1
    return [hook.state, setState]
}

const updateHostComponent = function(fiber) {
    if(!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    reconcileChildren(fiber, fiber.props.children)
}

const reconcileChildren = function(wipFiber, elements) {
    let index = 0
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null

    while(index < elements.length || oldFiber != null) {
        const element = elements[index]
        let newFiber = null

        const sameType = oldFiber && element && element.type === oldFiber.type

        if(sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: 'UPDATE',
            }
        }
        if(element && !sameType) {
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: 'PLACEMENT',
            }
        }
        if(oldFiber && !sameType) {
            oldFiber.effectTag = 'DELETION'
            deletions.push(oldFiber)
        }

        if(oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if(index === 0) {
            wipFiber.child = newFiber
        } else if(element) {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index += 1
    }
}

export {
    createElement,
    render,
    useState,
}
