import { User } from '../../shared/models/User.model'
import { RemultGrid } from '../../../src/views/RemultGrid'

const GridRoute = () => {
	return (
		<RemultGrid
			entity={User}
			showId
			fieldsToShow={[
				'id',
				'email',
				'workingHoursStart',
				'firstName',
				'lastName',
			]}
			// gridOptions={{ checkboxSelection: false }}
		/>
	)
}

export default GridRoute
