/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	ChangeEvent,
	FormEvent,
	ReactNode,
	useEffect,
	useReducer,
	useState,
} from 'react'
import { remult } from 'remult'
import type { FieldMetadata, FieldsMetadata } from 'remult'
import { Box, Button, Typography } from '@mui/material'
import type { EntityMetaDisplay, ID, SelectOption } from './types'
import { getFieldType, isHideField, isMetaActionBlocked } from './util'
import { getRelationInfo } from 'remult/internals'
import RemultTextField from './components/Textfield'
import RemultCheckbox from './components/Checkbox'
import RemultDatepicker from './components/Datepicker'
import RemultAutocomplete from './components/Autocomplete'
import RemultAutocompleteMultiple from './components/AutocompleteMultiple'
import RemultCheckboxMultiple from './components/CheckboxMultiple'
import RemultRadioGroup from './components/RadioGroup'
import { UILibContext } from './UILibContext'

const reducer = <T,>(state: T, action: any) => {
	return {
		...state,
		...action,
	}
}

interface RemultFormP<T> {
	/** Existing model instance if edit case. Empty for create */
	item?: T
	/** Custom form title */
	title?: string
	/** Trigger on form submit. This will pass the created/edited item and will NOT perform the action. */
	onSubmit?: (item: T | undefined) => void
	/** Trigger on action completed. When create/edit action is done this will be fired */
	onDone?: (item: T[] | undefined) => void
	uiLib?: 'mui_v5' | 'joy_ui'
}

export const RemultForm = <T extends { id: ID }>({
	entity,
	repo: repoExternal,
	item,
	showId,
	showCreatedAt,
	showUpdatedAt,
	title,
	onSubmit,
	onDone,
	fieldsToShow = [],
	// [ ] options per form instance - checkbox in 1 vs select in other
	// [ ] extra field not inside entity
	// grid
	// [ ] table level action
	// Example: print 3 user's details. Send these 3 users an email
	// same on row level
	// Options: text, visibleCondition, onClick, icon
	// [ ] custom field
	uiLib = 'mui_v5',
}: RemultFormP<T> & EntityMetaDisplay<T>): ReactNode => {
	const [isEdit, setIsEdit] = useState(false)
	const [errors, setErrors] = useState<{ [k in keyof T]?: string }>({})
	const [relations, setRelations] = useState<{
		[k in keyof Partial<T>]?: any[]
	}>({})

	const [state, dispatch] = useReducer(
		reducer,
		// item ? { ...item } : remult.repo(entity).create()
		{}
	)

	const repo = entity ? remult.repo(entity) : repoExternal

	useEffect(() => {
		dispatch(item ? { ...item } : repo?.create())
		if (repo) {
			loadRelations(repo.fields)
		}
		setIsEdit(!!item?.id)
	}, [item, entity, repo?.fields])

	const loadRelations = async (fields: FieldsMetadata<T>) => {
		const res: any = {}
		for (const f of fields.toArray()) {
			if (
				fieldsToShow.length &&
				fieldsToShow.indexOf(f.key as keyof T) === -1
			) {
				continue
			}
			const relationInfo = getRelationInfo(f.options)
			if (relationInfo) {
				const relatedEntities = await remult.repo(relationInfo.toType()).find()
				res[f.key] = relatedEntities
			}
		}
		setRelations({ ...res })
	}

	const onChangeTextfield = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
		key: string
	) => {
		// setInternalItem({ ...internalItem, [key]: e.target.value })
		// item.email = e.target.value
		// setItem(item)
		dispatch({
			[key]: e.target.value,
		})
	}

	const onChangeCheckbox = (e: ChangeEvent<HTMLInputElement>, key: string) =>
		dispatch({
			[key]: e.target.checked,
		})

	const onChangeDate = (newDate: unknown, key: string) =>
		dispatch({
			[key]: new Date(newDate as any),
		})

	const onRelationSelect = <T,>(
		selected: string | number,
		f: FieldMetadata<any, T>
	) => {
		// @ts-expect-error TODO: same issue here with relation type. Need to fix
		dispatch({ [f.options.field]: selected })
	}

	const onSingleSelect = <T,>(
		selected: string | number,
		f: FieldMetadata<any, T>
	) => {
		dispatch({ [f.key]: selected })
	}

	const onMultiSelect = <T,>(
		selected: Pick<SelectOption, 'id'>[],
		f: FieldMetadata<any, T>
	) => {
		dispatch({ [f.key]: [...selected.map((item) => item.id)] })
	}

	const resetForm = () => dispatch(repo?.create())

	const onSubmitInternal = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()

		setErrors({})

		if (onSubmit) {
			onSubmit(state)
			return resetForm()
		}
		try {
			if (isEdit) {
				await onEdit()
			} else {
				await onCreate()
				resetForm()
			}
		} catch (e: any) {
			if (e.modelState) {
				setErrors({ ...e.modelState })
			}
		}
	}

	const onEdit = async () => {
		const res = await repo?.save(state)
		onDone && onDone(res)
	}

	const onCreate = async () => {
		const res = await repo?.insert(state)
		onDone && onDone(res)
	}

	const renderForm = <T,>(fields: FieldsMetadata<T>) => {
		return fields
			.toArray()
			.slice()
			.sort((a, b) => (a.key > b.key ? 1 : -1))
			.sort((a, b) => {
				// @ts-expect-error TODO: fix type error here
				if (fieldsToShow.indexOf(a.key) === -1) {
					return 1
				}
				// @ts-expect-error TODO: fix type error here
				if (fieldsToShow.indexOf(b.key) === -1) {
					return -1
				}
				// @ts-expect-error TODO: fix type error here
				return fieldsToShow.indexOf(a.key) - fieldsToShow.indexOf(b.key)
			})
			.map((f) => {
				if (
					isHideField(
						f,
						fields.toArray(),
						isEdit,
						showId,
						showCreatedAt,
						showUpdatedAt,
						fieldsToShow
					)
				) {
					return
				}
				const fieldType = getFieldType(f)
				const rawVal = state[f.key as keyof typeof state]
				const relationInfo = getRelationInfo(f.options)
				// @ts-expect-error TODO: how to do keyof Partial<T>
				// Thought of using PropertyKey as suggested here:
				// https://stackoverflow.com/a/71531880/5248229
				// but this created other issues
				if (relationInfo && relations[f.key]) {
					// @ts-expect-error TODO: fix
					const mapped = relations[f.key].map((r: any) => ({
						id: r.id,
						label: r.name || r.id,
					}))
					return (
						<RemultAutocomplete
							key={f.key}
							label={f.caption || f.key}
							options={mapped}
							// @ts-expect-error TODO: fix this
							selectedId={state[f.options.field]}
							onSelect={(newVal) => onRelationSelect(newVal, f)}
							// @ts-expect-error TODO: fix
							error={errors[f.key]}
						/>
					)
				} else if (fieldType === 'singleSelect') {
					if (!f.options.select?.type || f.options.select.type === 'radiobox') {
						return (
							<RemultRadioGroup
								row
								key={f.key}
								label={f.caption || f.key}
								options={f.options.select?.options || []}
								selectedId={state[f.key]}
								onSelect={(newVal) => onSingleSelect(newVal, f)}
								// @ts-expect-error TODO: fix
								error={errors[f.key]}
							/>
						)
					} else if (f.options.select.type === 'select') {
						return (
							<RemultAutocomplete
								key={f.key}
								label={f.caption || f.key}
								options={f.options.select.options}
								selectedId={state[f.key]}
								onSelect={(newVal) => onSingleSelect(newVal, f)}
								// @ts-expect-error TODO: fix
								error={errors[f.key]}
							/>
						)
					}
				} else if (fieldType === 'multiSelect') {
					if (!f.options.select?.type || f.options.select.type === 'checkbox') {
						return (
							<RemultCheckboxMultiple
								row
								key={f.key}
								label={f.caption || f.key}
								options={f.options.select?.options || []}
								selected={state[f.key]?.map((item: ID) => ({
									id: item,
								}))}
								onSelect={(newVal) => onMultiSelect(newVal, f)}
								// @ts-expect-error TODO: fix
								error={errors[f.key]}
							/>
						)
					} else if (f.options.select.type === 'select') {
						return (
							<RemultAutocompleteMultiple
								key={f.key}
								label={f.caption || f.key}
								options={f.options.select.options}
								selected={state[f.key]?.map((item: ID) => ({
									id: item,
								}))}
								onSelect={(newVal) => onMultiSelect(newVal, f)}
								// @ts-expect-error TODO: fix
								error={errors[f.key]}
							/>
						)
					}
				} else if (fieldType === 'string' || fieldType === 'number') {
					// if (f.valueType == String || f.valueType == Number) {
					return (
						<RemultTextField
							key={f.key}
							// val={state[f.key as keyof typeof state]}
							val={
								(rawVal &&
									f.valueConverter.toInput &&
									f.valueConverter.toInput(rawVal)) ||
								rawVal
							}
							field={f}
							onChange={(e) => onChangeTextfield(e, f.key)}
							// @ts-expect-error TODO: fix
							error={errors[f.key]}
						/>
					)
				} else if (fieldType === 'boolean') {
					return (
						<RemultCheckbox
							key={f.key}
							label={f.caption || f.key}
							disabled={isMetaActionBlocked(f.options.allowApiUpdate)}
							checked={!!rawVal}
							onChange={(e) => onChangeCheckbox(e, f.key)}
						/>
					)
				} else if (fieldType === 'date') {
					return (
						<RemultDatepicker
							key={f.key}
							field={f}
							onChange={(newDate) => onChangeDate(newDate, f.key)}
						/>
					)
				}
			})
	}

	return (
		<UILibContext.Provider value={uiLib}>
			<Box
				component='form'
				onSubmit={onSubmitInternal}
				sx={{ display: 'flex', flexDirection: 'column' }}
			>
				<Typography sx={{ mb: 1 }}>
					{title || `${isEdit ? 'Edit ' : 'Create'} ${repo?.metadata.caption}`}
				</Typography>
				{repo && renderForm(repo.fields)}
				<Button type='submit' sx={{ m: 1 }} variant='contained'>
					{`${isEdit ? 'Save' : 'Create'}`}
				</Button>
			</Box>
		</UILibContext.Provider>
	)
}
