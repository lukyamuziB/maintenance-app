import React from 'react';
import Paper from 'material-ui/lib/paper';
import OrganisationUnitTreeWithSingleSelectionAndSearch from '../OrganisationUnitTree/OrganisationUnitTreeWithSingleSelectionAndSearch.component';
import withStateFrom from 'd2-ui/lib/component-helpers/withStateFrom';
import { setAppState, default as appState } from '../App/appStateStore';
import Action from 'd2-ui/lib/action/Action';
import RaisedButton from 'material-ui/lib/raised-button';
import addD2Context from 'd2-ui/lib/component-helpers/addD2Context';
import { getInstance } from 'd2/lib/d2';
import { Observable } from 'rx';
import snackActions from '../Snackbar/snack.actions';
import Heading from 'd2-ui/lib/headings/Heading.component';
import searchForOrganisationUnitsWithinHierarchy from './searchForOrganisationUnitsWithinHierarchy';
import log from 'loglevel';
import FontIcon from 'material-ui/lib/font-icon';

function identity(v) {
    return v;
}

const d2$ = Observable.fromPromise(getInstance());

const hierarchy$ = appState
    .map(appState => appState.hierarchy || {});

function getOrgUnitTreeSearchFromAction(action) {
    return action
        .debounce(400)
        .filter(action => action.data)
        .map(({ complete, error, data }) => {
            return Observable.fromPromise(searchForOrganisationUnitsWithinHierarchy(data, 50))
                .map(organisationUnits => {
                    return {
                        complete,
                        error,
                        organisationUnits,
                    };
                });
        })
        .concatAll()
        .flatMap((v) => {
            return Observable.just(v).combineLatest(hierarchy$.take(1));
        });
}

const rightTreeSearch = Action.create('rightTreeSearch', 'Hierarchy');
getOrgUnitTreeSearchFromAction(rightTreeSearch)
    .subscribe(([result, hierarchy]) => {
        setAppState({
            hierarchy:  {
                ...hierarchy,
                rightRoots: result.organisationUnits,
            },
        });
    });
rightTreeSearch
    .filter(action => !action.data)
    .flatMap(action => hierarchy$.take(1))
    .subscribe((appState) => {
        setAppState({
            hierarchy:  {
                ...appState.hierarchy,
                // Reset the roots of the right tree to the original root(s)
                leftRoots: appState.userOrganisationUnits.toArray(),
            },
        });
    });

const leftTreeSearch = Action.create('leftTreeSearch', 'Hierarchy');
getOrgUnitTreeSearchFromAction(leftTreeSearch)
    .subscribe(([result, hierarchy]) => {
        setAppState({
            hierarchy:  {
                ...appState.state.hierarchy,
                leftRoots: result.organisationUnits,
            },
        });
    });
leftTreeSearch
    .filter(action => !action.data)
    .flatMap(action => appState.take(1))
    .subscribe((appState) => {
        setAppState({
            hierarchy:  {
                ...appState.hierarchy,
                // Reset the roots of the left tree to the original root(s)
                leftRoots: appState.userOrganisationUnits.toArray(),
            },
        });
    });

const organisationUnitHierarchy$ = appState
    .map(({ hierarchy = {}, userOrganisationUnits }) => {
        return {
            roots: userOrganisationUnits.toArray(),
            leftRoots: hierarchy.leftRoots,
            rightRoots: hierarchy.rightRoots,
            initiallyExpanded: [],
            selectedLeft: hierarchy.selectedLeft || [],
            selectedRight: hierarchy.selectedRight || [],
            isProcessing: hierarchy.isProcessing,
            reload: hierarchy.reload,
        };
    });

function onClickLeft(event, model) {
    hierarchy$
        .take(1) // Only grab the current state
        .subscribe(
            (hierarchy) => {
                let selectedLeft = [];
                let indexOfModelInSelected = hierarchy.selectedLeft
                    .map(model => model.id)
                    .indexOf(model.id);

                if (indexOfModelInSelected >= 0) {
                    selectedLeft = hierarchy.selectedLeft
                       .slice(0, indexOfModelInSelected)
                       .concat(hierarchy.selectedLeft.slice(indexOfModelInSelected + 1));
                } else {
                    selectedLeft = hierarchy.selectedLeft.concat([model]);
                }

                setAppState({
                    hierarchy:  {
                        ...hierarchy,
                        reload: [],
                        selectedLeft,
                    },
                });
            }
        );
}

const operationsCompleted = Action.create('operationsCompleted', 'Hierarchy');

async function getOrganisationUnitByIds(ids) {
    const d2 = await getInstance();

    const organisationUnits = await d2.models.organisationUnit
        .list({ filter: [`id:in:[${ids.join(',')}]`], fields: ':owner,href,id,parent,displayName,path,children[id,displayName,path]' });

    return organisationUnits.toArray();
}

function setHierarchyProcessingStatus(hierarchy, status) {
    setAppState({
        hierarchy: {
            ...hierarchy,
            isProcessing: status,
        }
    });
}

function changeOrganisationUnitParentAndSave(organisationUnit) {
    return hierarchy$
        .take(1)
        .combineLatest(d2$)
        .flatMap(([hierarchy, d2]) => {
            organisationUnit.parent = { id: hierarchy.selectedRight[0] && hierarchy.selectedRight[0].id };

            const movingStatus = organisationUnit
                .save()
                .then(() => d2.i18n.getTranslation('successfully_moved_$$ouName$$', { ouName: organisationUnit.displayName }))
                .catch((e) => d2.i18n.getTranslation('failed_to_move_$$ouName$$_($$errorMessage$$)', {
                    ouName: organisationUnit.displayName,
                    errorMessage: e,
                }));

            return Observable.fromPromise(movingStatus);
        });
}

function moveOrganisationUnit() {
    hierarchy$
        .take(1)
        .do((hierarchy) => setHierarchyProcessingStatus(hierarchy, true))
        .map(hierarchy => (hierarchy.selectedLeft || []).map(model => model.id))
        .flatMap((ouIds) => Observable
            .fromPromise(getOrganisationUnitByIds(ouIds))
            .flatMap(identity)
        )
        .map(changeOrganisationUnitParentAndSave)
        .concatAll()
        .subscribe(
            (message) => {
                snackActions.show({ message, translate: false });

                const hierarchy = Object.assign({}, appState.state.hierarchy);
                setAppState({
                    hierarchy: {
                        ...hierarchy,
                        isProcessing: false,
                        reload: []
                            .concat(hierarchy.selectedRight.map(model => model.id))
                            .concat(hierarchy.selectedLeft.map(model => {
                                if (model.parent && model.parent.id) {
                                    return model.parent.id;
                                }
                                return appState.state.hierarchy.leftRoots
                                    .concat(appState.state.hierarchy.rightRoots)
                                    .map(value => value.id)
                                    .filter(rootId => new RegExp(rootId).test(model.path))
                                    .reduce(value => {
                                        return value;
                                    });
                            })),
                    }
                });
            },
            (e) => {
                setHierarchyProcessingStatus(appState.state.hierarchy, false);
            },
            () => {
                const hierarchy = Object.assign({}, appState.state.hierarchy);

                hierarchy.selectedLeft = [];
                hierarchy.selectedRight = [];
                hierarchy.initiallySelected = [];
                setAppState({
                    hierarchy: {
                        ...hierarchy,
                        isProcessing: false,
                    }
                });
            }
        );
}

function onClickRight(event, model) {
    hierarchy$
        .take(1) // Only grab the current state
        .subscribe(
            (hierarchy) => setAppState({
                hierarchy:  {
                    ...hierarchy,
                    reload: [],
                    selectedRight: [model],
                },
            })
        );
}

function SelectedOrganisationUnitList(props, context) {
    const styles = {
        title: {
            color: '#666',
            marginBottom: '.5rem',
        },
        message: {
            color: '#666',
            padding: '.5rem',
            display: 'block',
        },
        list: {
            paddingLeft: '1.5rem',
        },
    };

    const listItems = props.organisationUnits
        .map(model => <li key={model.id}>{model.displayName}</li>);

    const noOrganisationUnitsMessage = (
        <span style={styles.message}>{context.d2.i18n.getTranslation(props.noOrganisationUnitsMessage)}</span>
    );

    return (
        <div style={props.style}>
            <div style={styles.title}>{context.d2.i18n.getTranslation(props.title)}</div>
            {listItems.length ? <ul style={styles.list}>{listItems}</ul> : noOrganisationUnitsMessage}
        </div>
    );
}
SelectedOrganisationUnitList.defaultProps = {
    organisationUnits: [],
};

const SelectedOrganisationUnitListWithContext = addD2Context(SelectedOrganisationUnitList);

function hasEqualElement(left, right, selector) {
    return left.map(selector).some((item) => right.map(selector).indexOf(item) >= 0);
}

function splitOuPath(path = '') {
    return path
        .split('/')
        .filter(part => part);
}

function sourceIsInPathOfTarget(source, target) {
    if (source.some(model => !model.path) || target.some(model => !model.path)) {
        log.warn('No path found, so can not run hierarchy validation');
        return true;
    }

    if (target.length !== 1) {
        log.warn('More than/less than 1 target found, can not move.');
        return true;
    }

    const targetModel = target[0];

    return source.some((sourceModel) => {
        return splitOuPath(targetModel.path).indexOf(sourceModel.id) >= 0;
    });
}

function moveButtonDisabled(props) {
    return props.isProcessing ||
        !props.selectedLeft.length ||
        !props.selectedRight.length ||
        hasEqualElement(props.selectedLeft, props.selectedRight, v => v && v.id) ||
        sourceIsInPathOfTarget(props.selectedLeft, props.selectedRight);
}

function OrganisationUnitHierarchy(props, context) {
    const styles = {
        wrap: {
            flex: 1,
            display: 'flex',
            flexOrientation: 'row',
        },
        ouTreeLeft: {
            flex: 1,
            marginRight: '2rem',
            padding: '1rem',
        },
        ouTreeRight: {
            flex: 1,
            padding: '1rem',
        },
        moveButton: {
            width: '100%',
            marginBottom: '1rem',
            marginTop: '1rem',
        },
        pendingOperationsWrap: {
            padding: '1rem',
            marginBottom: '1rem',
        },
        pendingOperationsListsWrap: {
            display: 'flex',
            flexDirection: 'row',
        },
        pendingOperationsList: {
            flex: 1,
            padding: '.5rem',
        },
        errorMessage: {
            color: 'orange',
            lineHeight: '1.5rem',
            paddingBottom: '1rem',
        },
        errorIcon: {
            color: 'orange',
        }
    };

    const buttonLabel = context.d2.i18n.getTranslation('move_$$ouCount$$_organisation_units', { ouCount: (props.selectedLeft && props.selectedLeft.length) || 0 });
    const headingTitle = context.d2.i18n.getTranslation('hierarchy_operations');
    const warningForMovingWithinSubtree = context.d2.i18n.getTranslation('you_can_not_move_higher_level_organisation_units_to_its_descendants');
    return (
        <div>
            <Heading>{headingTitle}</Heading>
            <RaisedButton
                primary
                style={styles.moveButton}
                label={buttonLabel}
                onClick={moveOrganisationUnit}
                disabled={moveButtonDisabled(props)}
            />
            {props.selectedLeft.length && props.selectedRight.length && sourceIsInPathOfTarget(props.selectedLeft || [], props.selectedRight || []) ? <div style={styles.errorMessage}><FontIcon style={styles.errorIcon} className="material-icons">warning</FontIcon>{warningForMovingWithinSubtree}</div> : null}
            <Paper style={styles.pendingOperationsWrap}>
                <div style={styles.pendingOperationsListsWrap}>
                    <SelectedOrganisationUnitListWithContext
                        style={styles.pendingOperationsList}
                        organisationUnits={props.selectedLeft}
                        noOrganisationUnitsMessage="select_organisation_units_to_move_from_the_left_tree"
                        title="move"
                    />
                    <SelectedOrganisationUnitListWithContext
                        style={styles.pendingOperationsList}
                        organisationUnits={props.selectedRight}
                        noOrganisationUnitsMessage="select_new_parent_for_organisation_units_from_the_right_tree"
                        title="new_parent"
                    />
                </div>
            </Paper>
            <div style={styles.wrap}>
                <Paper style={styles.ouTreeLeft}>
                    <OrganisationUnitTreeWithSingleSelectionAndSearch
                        roots={props.leftRoots}
                        initiallyExpanded={props.initiallyExpanded}
                        selected={props.selectedLeft.map(model => model.id)}
                        onClick={onClickLeft}
                        onUpdateInput={value => leftTreeSearch(value)}
                        idsThatShouldBeReloaded={props.reload}
                    />
                </Paper>
                <Paper style={styles.ouTreeRight}>
                    <OrganisationUnitTreeWithSingleSelectionAndSearch
                        roots={props.rightRoots}
                        selected={props.selectedRight.map(model => model.id)}
                        initiallyExpanded={props.initiallyExpanded}
                        onClick={onClickRight}
                        onUpdateInput={value => rightTreeSearch(value)}
                        idsThatShouldBeReloaded={props.reload}
                    />
                </Paper>
            </div>
        </div>
    );
}
OrganisationUnitHierarchy.defaultProps = {
    selectedLeft: [],
    selectedRight: [],
};

export default withStateFrom(organisationUnitHierarchy$, addD2Context(OrganisationUnitHierarchy));